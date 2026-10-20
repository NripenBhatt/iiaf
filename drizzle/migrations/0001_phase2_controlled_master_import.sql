CREATE TABLE public.master_import_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), initiated_by uuid NOT NULL REFERENCES public.profiles(id), source_workbook text NOT NULL, source_sha256 text NOT NULL, mode text NOT NULL CHECK(mode IN ('sample','full')), expected_rows integer NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','verified','failed')), validation_summary jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.master_import_runs TO authenticated; GRANT ALL ON public.master_import_runs TO service_role;
ALTER TABLE public.master_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_runs_read ON public.master_import_runs FOR SELECT TO authenticated USING(public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));
CREATE TABLE public.master_reference_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_sheet text NOT NULL, source_identifier text NOT NULL, source_row integer NOT NULL, source_workbook text NOT NULL, source_sha256 text NOT NULL, source_fields jsonb NOT NULL, first_run_id uuid NOT NULL REFERENCES public.master_import_runs(id), agency_record_id uuid REFERENCES public.master_reference_records(id), evidence_record_id uuid REFERENCES public.master_reference_records(id), requirement_record_id uuid REFERENCES public.master_reference_records(id), field_record_id uuid REFERENCES public.master_reference_records(id), parent_record_id uuid REFERENCES public.master_reference_records(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_sheet,source_identifier));
GRANT SELECT ON public.master_reference_records TO authenticated; GRANT ALL ON public.master_reference_records TO service_role;
ALTER TABLE public.master_reference_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_records_read ON public.master_reference_records FOR SELECT TO authenticated USING(public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));
CREATE TABLE public.master_import_outcomes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.master_import_runs(id), source_sheet text NOT NULL, source_row integer NOT NULL, source_identifier text, outcome text NOT NULL CHECK(outcome IN ('inserted','skipped','rejected','conflict')), reason text NOT NULL, target_record_id uuid REFERENCES public.master_reference_records(id), source_fields jsonb, mapping_log jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,source_sheet,source_row));
GRANT SELECT ON public.master_import_outcomes TO authenticated; GRANT ALL ON public.master_import_outcomes TO service_role;
ALTER TABLE public.master_import_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_outcomes_read ON public.master_import_outcomes FOR SELECT TO authenticated USING(public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));
CREATE INDEX master_outcome_run ON public.master_import_outcomes(run_id);
CREATE FUNCTION public.begin_master_import(_org uuid,_workbook text,_sha text,_mode text,_expected integer,_approval boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rid uuid; BEGIN
IF NOT public.is_member(_org) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=_org AND kind='internal') OR NOT public.is_operator(ARRAY['super_admin','authorized_operator']::public.app_role[]) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF NOT _approval OR _mode NOT IN ('sample','full') OR _expected<1 OR _expected>40000 OR _sha !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid import approval'; END IF;
IF _mode='full' AND NOT EXISTS(SELECT 1 FROM public.master_import_runs WHERE mode='sample' AND state='verified' AND source_sha256=_sha AND (validation_summary->>'idempotency_verified')::boolean IS TRUE) THEN RAISE EXCEPTION 'Passing sample and idempotency verification required'; END IF;
INSERT INTO public.master_import_runs(organization_id,initiated_by,source_workbook,source_sha256,mode,expected_rows) VALUES(_org,auth.uid(),_workbook,_sha,_mode,_expected) RETURNING id INTO rid;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),_org,'master_import.approved','success',jsonb_build_object('run_id',rid,'mode',_mode,'sha256',_sha)); RETURN rid; END $$;
CREATE FUNCTION public.process_master_import(_run uuid,_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE run public.master_import_runs; r jsonb; f jsonb; sheet text; sid text; key text; refkey text; reftable text; aid uuid; eid uuid; qid uuid; fid uuid; pid uuid; refid uuid; tid uuid; status text; why text; existing jsonb; num integer:=0; BEGIN
SELECT * INTO run FROM public.master_import_runs WHERE id=_run FOR UPDATE;
IF run.id IS NULL OR run.state<>'running' OR NOT public.is_member(run.organization_id) OR NOT public.is_operator(ARRAY['super_admin','authorized_operator']::public.app_role[]) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)>200 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
PERFORM pg_advisory_xact_lock(202610202);
FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
sheet:=r->>'sheet'; sid:=r->>'identifier'; f:=r->'fields'; tid:=NULL; aid:=NULL;eid:=NULL;qid:=NULL;fid:=NULL;pid:=NULL;status:='inserted';why:='Original fields preserved';
IF EXISTS(SELECT 1 FROM public.master_import_outcomes WHERE run_id=_run AND source_sheet=sheet AND source_row=(r->>'row')::integer) THEN CONTINUE; END IF;
IF r->>'disposition'='excluded' THEN status:='skipped';why:=r->>'reason';
ELSIF r->>'disposition'='held' THEN status:='rejected';why:=r->>'reason';
ELSE
key:=CASE sheet WHEN 'AGENCY_MASTER' THEN 'Agency_ID' WHEN 'EVIDENCE_MASTER' THEN 'Evidence_ID' WHEN 'AGENCY_REQUIREMENT_MASTER' THEN 'Requirement_ID' WHEN 'AGENCY_FIELD_MASTER' THEN 'Agency_Field_ID' WHEN 'EVIDENCE_REQUIREMENT_MAPPING' THEN 'Mapping_ID' END;
IF key IS NULL OR sid IS NULL OR f->>key IS DISTINCT FROM sid THEN status:='rejected';why:='Missing or inconsistent original identifier'; END IF;
IF status='inserted' THEN
FOR refkey,reftable IN SELECT * FROM (VALUES ('Agency_ID','AGENCY_MASTER'),('Evidence_ID','EVIDENCE_MASTER'),('Requirement_ID','AGENCY_REQUIREMENT_MASTER'),('Agency_Field_ID','AGENCY_FIELD_MASTER'),('Parent_Requirement_ID','AGENCY_REQUIREMENT_MASTER')) x(k,t) LOOP
IF (sheet IN ('AGENCY_REQUIREMENT_MASTER','AGENCY_FIELD_MASTER','EVIDENCE_REQUIREMENT_MAPPING') AND refkey='Agency_ID') OR (sheet IN ('AGENCY_FIELD_MASTER','EVIDENCE_REQUIREMENT_MAPPING') AND refkey='Requirement_ID') OR (sheet='EVIDENCE_REQUIREMENT_MAPPING' AND refkey IN ('Evidence_ID','Agency_Field_ID')) OR (sheet='AGENCY_REQUIREMENT_MASTER' AND refkey='Parent_Requirement_ID' AND f->>refkey IS NOT NULL) THEN
SELECT id INTO refid FROM public.master_reference_records WHERE source_sheet=reftable AND source_identifier=f->>refkey;
IF refid IS NULL THEN status:='rejected';why:='Invalid or held reference: '||refkey; EXIT; END IF;
CASE refkey WHEN 'Agency_ID' THEN aid:=refid; WHEN 'Evidence_ID' THEN eid:=refid; WHEN 'Requirement_ID' THEN qid:=refid; WHEN 'Agency_Field_ID' THEN fid:=refid; ELSE pid:=refid; END CASE;
END IF; END LOOP;
END IF;
IF status='inserted' AND qid IS NOT NULL AND aid IS DISTINCT FROM (SELECT agency_record_id FROM public.master_reference_records WHERE id=qid) THEN status:='rejected';why:='Requirement agency mismatch'; END IF;
IF status='inserted' AND fid IS NOT NULL AND qid IS DISTINCT FROM (SELECT requirement_record_id FROM public.master_reference_records WHERE id=fid) THEN status:='rejected';why:='Field requirement mismatch'; END IF;
IF status='inserted' THEN
SELECT id,source_fields INTO tid,existing FROM public.master_reference_records WHERE source_sheet=sheet AND source_identifier=sid;
IF tid IS NOT NULL THEN IF existing=f THEN status:='skipped';why:='Exact existing record; no overwrite'; ELSE status:='conflict';why:='Existing source fields differ; preserved unchanged';END IF;
ELSE INSERT INTO public.master_reference_records(source_sheet,source_identifier,source_row,source_workbook,source_sha256,source_fields,first_run_id,agency_record_id,evidence_record_id,requirement_record_id,field_record_id,parent_record_id) VALUES(sheet,sid,(r->>'row')::integer,run.source_workbook,run.source_sha256,f,_run,aid,eid,qid,fid,pid) RETURNING id INTO tid; END IF; END IF;
END IF;
INSERT INTO public.master_import_outcomes(run_id,source_sheet,source_row,source_identifier,outcome,reason,target_record_id,source_fields,mapping_log) VALUES(_run,sheet,(r->>'row')::integer,sid,status,why,tid,f,jsonb_build_object('identifier_column',key,'original_columns_preserved',true,'source_sha256',run.source_sha256,'disposition',r->>'disposition'));
num:=num+1;
END LOOP; RETURN num; END $$;
CREATE FUNCTION public.finish_master_import(_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE run public.master_import_runs; counts jsonb; total integer; mismatches integer; repeat_ok boolean; BEGIN
SELECT * INTO run FROM public.master_import_runs WHERE id=_run FOR UPDATE;
IF run.id IS NULL OR NOT public.is_member(run.organization_id) OR NOT public.is_operator(ARRAY['super_admin','authorized_operator']::public.app_role[]) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
SELECT count(*) INTO total FROM public.master_import_outcomes WHERE run_id=_run;
SELECT count(*) INTO mismatches FROM public.master_import_outcomes o LEFT JOIN public.master_reference_records t ON t.id=o.target_record_id WHERE o.run_id=_run AND o.target_record_id IS NOT NULL AND o.outcome IN ('inserted','skipped') AND (t.id IS NULL OR t.source_fields IS DISTINCT FROM o.source_fields OR t.source_identifier IS DISTINCT FROM o.source_identifier OR t.source_sheet IS DISTINCT FROM o.source_sheet);
SELECT jsonb_build_object('source_rows',total,'inserted',count(*) FILTER(WHERE outcome='inserted'),'updated',0,'skipped',count(*) FILTER(WHERE outcome='skipped'),'rejected',count(*) FILTER(WHERE outcome='rejected'),'conflicts',count(*) FILTER(WHERE outcome='conflict'),'readback_mismatches',mismatches) INTO counts FROM public.master_import_outcomes WHERE run_id=_run;
repeat_ok:=run.mode='sample' AND (counts->>'inserted')::integer=0 AND (counts->>'skipped')::integer>0 AND EXISTS(SELECT 1 FROM public.master_import_runs p WHERE p.id<>_run AND p.mode='sample' AND p.state='verified' AND p.source_sha256=run.source_sha256 AND p.expected_rows=run.expected_rows AND NOT EXISTS(SELECT 1 FROM public.master_import_outcomes a WHERE a.run_id=p.id AND NOT EXISTS(SELECT 1 FROM public.master_import_outcomes b WHERE b.run_id=_run AND b.source_sheet=a.source_sheet AND b.source_row=a.source_row AND b.source_fields IS NOT DISTINCT FROM a.source_fields)));
counts:=counts||jsonb_build_object('idempotency_verified',repeat_ok,'expected_rows',run.expected_rows);
UPDATE public.master_import_runs SET state=CASE WHEN total=expected_rows AND mismatches=0 AND (counts->>'conflicts')::integer=0 THEN 'verified' ELSE 'failed' END,completed_at=now(),validation_summary=counts WHERE id=_run;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),run.organization_id,'master_import.finished','success',counts||jsonb_build_object('run_id',_run));RETURN counts;END $$;
REVOKE ALL ON FUNCTION public.begin_master_import(uuid,text,text,text,integer,boolean),public.process_master_import(uuid,jsonb),public.finish_master_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_master_import(uuid,text,text,text,integer,boolean),public.process_master_import(uuid,jsonb),public.finish_master_import(uuid) TO authenticated;
COMMENT ON TABLE public.master_reference_records IS 'Company-restricted agency-wide templates and source candidates; never official mapping approval or university evidence';