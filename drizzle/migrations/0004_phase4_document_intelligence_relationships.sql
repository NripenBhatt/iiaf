ALTER TABLE public.held_record_reviews DROP CONSTRAINT held_record_reviews_decision_check;
ALTER TABLE public.held_record_reviews ADD CONSTRAINT held_record_reviews_decision_check CHECK (decision IN ('keep_held','source_correction_required','escalate_for_expert_review','approve_for_import','exclude_documented'));
ALTER TABLE public.held_record_reviews ADD COLUMN finding text, ADD COLUMN affected_fields text, ADD COLUMN correction text, ADD COLUMN revalidation_result text;
ALTER TABLE public.held_record_reviews ADD CONSTRAINT held_review_approval_requires_pass CHECK (decision <> 'approve_for_import' OR revalidation_result = 'pass');
DROP POLICY held_review_insert ON public.held_record_reviews;
CREATE POLICY held_review_insert ON public.held_record_reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid() AND public.is_member(organization_id) AND public.is_operator(ARRAY['super_admin','internal_reviewer']::public.app_role[]) AND (decision <> 'exclude_documented' OR public.is_operator(ARRAY['super_admin']::public.app_role[])));

ALTER TABLE public.uploaded_documents DROP CONSTRAINT uploaded_documents_processing_status_check;
ALTER TABLE public.uploaded_documents ADD CONSTRAINT uploaded_documents_processing_status_check CHECK (processing_status IN ('uploading','uploaded','validation_failed','upload_failed','awaiting_processing','queued','processing','extracted','needs_review','processing_failed','ocr_required'));
ALTER TABLE public.uploaded_documents DROP CONSTRAINT uploaded_documents_extraction_status_check;
ALTER TABLE public.uploaded_documents ADD CONSTRAINT uploaded_documents_extraction_status_check CHECK (extraction_status IN ('not_started','processing','extracted','needs_review','failed','ocr_required','unsupported'));

CREATE TABLE public.document_processing_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.uploaded_documents(id),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 state text NOT NULL DEFAULT 'processing' CHECK (state IN ('processing','extracted','needs_review','ocr_required','processing_failed','interrupted')),
 processor text, processor_version text, error text,
 segment_count integer NOT NULL DEFAULT 0, fact_count integer NOT NULL DEFAULT 0,
 started_by uuid NOT NULL REFERENCES public.profiles(id),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
GRANT SELECT ON public.document_processing_jobs TO authenticated; GRANT ALL ON public.document_processing_jobs TO service_role;
ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY jobs_read ON public.document_processing_jobs FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.document_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.uploaded_documents(id),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 job_id uuid NOT NULL REFERENCES public.document_processing_jobs(id),
 seq integer NOT NULL, locator_key text NOT NULL, locator jsonb NOT NULL,
 page_number integer, sheet_name text, cell_ref text,
 content text NOT NULL, method text NOT NULL, method_version text NOT NULL,
 extracted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (document_id, locator_key, method_version));
GRANT SELECT ON public.document_segments TO authenticated; GRANT ALL ON public.document_segments TO service_role;
ALTER TABLE public.document_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY segments_read ON public.document_segments FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.proposed_facts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.uploaded_documents(id),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 segment_id uuid NOT NULL REFERENCES public.document_segments(id),
 source_label text NOT NULL, canonical_field text, spec_source text,
 extracted_value text NOT NULL, reviewed_value text,
 state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','unresolved_mapping','approved','corrected','rejected')),
 validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb, confidence numeric,
 locator_key text NOT NULL, locator jsonb NOT NULL, method text NOT NULL, method_version text NOT NULL,
 reviewer_id uuid REFERENCES public.profiles(id), reviewed_at timestamptz, review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (document_id, source_label, locator_key, method_version));
GRANT SELECT ON public.proposed_facts TO authenticated; GRANT ALL ON public.proposed_facts TO service_role;
ALTER TABLE public.proposed_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY facts_read ON public.proposed_facts FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.fact_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.proposed_facts(id),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 decision text NOT NULL CHECK (decision IN ('approve','correct','reject')),
 previous_state text NOT NULL, value text, note text,
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.fact_reviews TO authenticated; GRANT ALL ON public.fact_reviews TO service_role;
ALTER TABLE public.fact_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY fact_reviews_read ON public.fact_reviews FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 source_type text NOT NULL CHECK (source_type IN ('document','fact','master_record')),
 source_id uuid NOT NULL, source_label text NOT NULL,
 relation_type text NOT NULL CHECK (relation_type IN ('EXTRACTED_FROM','IDENTIFIES','MAPS_TO_REQUIREMENT','CONFLICTS_WITH')),
 target_type text NOT NULL CHECK (target_type IN ('document','fact','master_record')),
 target_id uuid NOT NULL, target_label text NOT NULL,
 rule_id text NOT NULL, rule_version text NOT NULL,
 status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','rejected','superseded')),
 provenance jsonb NOT NULL, confidence numeric,
 created_by uuid REFERENCES public.profiles(id), reviewer_id uuid REFERENCES public.profiles(id), reviewed_at timestamptz, review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, source_type, source_id, relation_type, target_type, target_id));
GRANT SELECT ON public.relationships TO authenticated; GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY relationships_read ON public.relationships FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.rule_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 rule_id text NOT NULL, rule_version text NOT NULL, trigger_event text NOT NULL,
 input_ref jsonb NOT NULL, created_count integer NOT NULL DEFAULT 0, existing_count integer NOT NULL DEFAULT 0,
 gaps jsonb NOT NULL DEFAULT '[]'::jsonb, actor_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.rule_runs TO authenticated; GRANT ALL ON public.rule_runs TO service_role;
ALTER TABLE public.rule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rule_runs_read ON public.rule_runs FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE FUNCTION public.relationship_endpoint_exists(_org uuid, _type text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT CASE _type
 WHEN 'document' THEN EXISTS(SELECT 1 FROM public.uploaded_documents WHERE id=_id AND organization_id=_org)
 WHEN 'fact' THEN EXISTS(SELECT 1 FROM public.proposed_facts WHERE id=_id AND organization_id=_org)
 WHEN 'master_record' THEN EXISTS(SELECT 1 FROM public.master_reference_records WHERE id=_id)
 ELSE false END $$;
CREATE FUNCTION public.validate_relationship() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.relationship_endpoint_exists(NEW.organization_id, NEW.source_type, NEW.source_id) OR NOT public.relationship_endpoint_exists(NEW.organization_id, NEW.target_type, NEW.target_id) THEN
 RAISE EXCEPTION 'Relationship endpoint does not exist';
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER relationship_refs BEFORE INSERT OR UPDATE OF source_id,target_id,source_type,target_type ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.validate_relationship();

CREATE FUNCTION public.may_review_facts(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT public.is_operator(ARRAY['super_admin','internal_reviewer']::public.app_role[]) OR EXISTS(SELECT 1 FROM public.user_roles r JOIN public.organization_memberships m ON m.id=r.membership_id WHERE m.user_id=auth.uid() AND m.organization_id=_org AND m.active AND r.role = ANY(ARRAY['university_administrator','registrar','iqac_manager']::public.app_role[])) $$;

CREATE FUNCTION public.begin_processing(_doc uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.uploaded_documents; j uuid;
BEGIN
SELECT * INTO d FROM public.uploaded_documents WHERE id=_doc FOR UPDATE;
IF d.id IS NULL OR NOT (public.may_upload(d.organization_id) OR public.may_review_facts(d.organization_id)) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF d.processing_status NOT IN ('awaiting_processing','queued','processing','extracted','needs_review','processing_failed','ocr_required') THEN RAISE EXCEPTION 'Document is not ready for processing'; END IF;
IF EXISTS(SELECT 1 FROM public.document_processing_jobs WHERE document_id=_doc AND state='processing' AND started_at > now()-interval '10 minutes') THEN RAISE EXCEPTION 'Processing already in progress'; END IF;
UPDATE public.document_processing_jobs SET state='interrupted', finished_at=now(), error='Superseded by a new attempt after interruption' WHERE document_id=_doc AND state='processing';
INSERT INTO public.document_processing_jobs(document_id,organization_id,started_by) VALUES(_doc,d.organization_id,auth.uid()) RETURNING id INTO j;
UPDATE public.uploaded_documents SET processing_status='processing', extraction_status='processing', updated_at=now() WHERE id=_doc;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),d.organization_id,'document.processing_started','success',jsonb_build_object('document_id',_doc,'job_id',j));
RETURN j;
END $$;

CREATE FUNCTION public.complete_processing(_job uuid, _status text, _processor text, _version text, _segments jsonb, _facts jsonb, _error text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE jb public.document_processing_jobs; s jsonb; f jsonb; seg uuid; nseg int:=0; nfact int:=0; nrel int:=0; existing int:=0; r record; ext text;
BEGIN
SELECT * INTO jb FROM public.document_processing_jobs WHERE id=_job FOR UPDATE;
IF jb.id IS NULL OR jb.started_by<>auth.uid() OR jb.state<>'processing' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF _status NOT IN ('extracted','needs_review','ocr_required','processing_failed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_segments,'[]'::jsonb)) LOOP
 INSERT INTO public.document_segments(document_id,organization_id,job_id,seq,locator_key,locator,page_number,sheet_name,cell_ref,content,method,method_version)
 VALUES(jb.document_id,jb.organization_id,_job,(s->>'seq')::int,s->>'locator_key',s->'locator',(s->>'page')::int,s->>'sheet',s->>'cell',left(s->>'content',8000),_processor,_version)
 ON CONFLICT (document_id,locator_key,method_version) DO NOTHING;
 IF FOUND THEN nseg:=nseg+1; END IF;
END LOOP;
FOR f IN SELECT * FROM jsonb_array_elements(coalesce(_facts,'[]'::jsonb)) LOOP
 seg := NULL;
 SELECT id INTO seg FROM public.document_segments WHERE document_id=jb.document_id AND locator_key=f->>'locator_key' AND method_version=_version;
 IF seg IS NULL THEN CONTINUE; END IF;
 INSERT INTO public.proposed_facts(document_id,organization_id,segment_id,source_label,canonical_field,spec_source,extracted_value,state,validation_issues,locator_key,locator,method,method_version)
 VALUES(jb.document_id,jb.organization_id,seg,f->>'label',f->>'field',f->>'spec',left(f->>'value',2000),CASE WHEN f->>'field' IS NULL THEN 'unresolved_mapping' ELSE 'proposed' END,coalesce(f->'issues','[]'::jsonb),f->>'locator_key',f->'locator',_processor,_version)
 ON CONFLICT (document_id,source_label,locator_key,method_version) DO NOTHING;
 IF FOUND THEN nfact:=nfact+1; END IF;
END LOOP;
FOR r IN SELECT p.id,p.source_label,p.locator_key,p.locator,d.original_filename,d.storage_object_key,d.sha256_hash FROM public.proposed_facts p JOIN public.uploaded_documents d ON d.id=p.document_id WHERE p.document_id=jb.document_id LOOP
 INSERT INTO public.relationships(organization_id,source_type,source_id,source_label,relation_type,target_type,target_id,target_label,rule_id,rule_version,status,provenance,created_by)
 VALUES(jb.organization_id,'fact',r.id,r.source_label,'EXTRACTED_FROM','document',jb.document_id,r.original_filename,'R-ENTITY-001','1.0','approved',jsonb_build_object('locator_key',r.locator_key,'locator',r.locator,'storage_object_key',r.storage_object_key,'sha256',r.sha256_hash,'job_id',_job,'method',_processor,'method_version',_version),auth.uid())
 ON CONFLICT DO NOTHING;
 IF FOUND THEN nrel:=nrel+1; ELSE existing:=existing+1; END IF;
END LOOP;
INSERT INTO public.rule_runs(organization_id,rule_id,rule_version,trigger_event,input_ref,created_count,existing_count,actor_id) VALUES(jb.organization_id,'R-ENTITY-001','1.0','FACT_CREATED',jsonb_build_object('document_id',jb.document_id,'job_id',_job),nrel,existing,auth.uid());
ext := CASE _status WHEN 'processing_failed' THEN 'failed' WHEN 'ocr_required' THEN 'ocr_required' WHEN 'needs_review' THEN 'needs_review' ELSE 'extracted' END;
UPDATE public.document_processing_jobs SET state=_status, processor=_processor, processor_version=_version, error=left(_error,500), segment_count=(SELECT count(*) FROM public.document_segments WHERE job_id=_job), fact_count=nfact, finished_at=now() WHERE id=_job;
UPDATE public.uploaded_documents SET processing_status=_status, extraction_status=ext, updated_at=now() WHERE id=jb.document_id;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),jb.organization_id,'document.processing_finished',CASE WHEN _status='processing_failed' THEN 'failure' ELSE 'success' END,jsonb_build_object('document_id',jb.document_id,'job_id',_job,'status',_status,'new_segments',nseg,'new_facts',nfact,'processor',_processor,'version',_version));
RETURN jsonb_build_object('status',_status,'new_segments',nseg,'new_facts',nfact,'new_relationships',nrel);
END $$;

CREATE FUNCTION public.apply_fact_rules(_fact uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.proposed_facts; v text; ev public.master_reference_records; m record; req public.master_reference_records; gaps jsonb:='[]'::jsonb; made int:=0; seen int:=0; o record;
BEGIN
SELECT * INTO p FROM public.proposed_facts WHERE id=_fact;
v := btrim(coalesce(p.reviewed_value,p.extracted_value));
IF p.state NOT IN ('approved','corrected') THEN RETURN '{}'::jsonb; END IF;
IF p.canonical_field='Evidence_ID' THEN
 SELECT * INTO ev FROM public.master_reference_records WHERE source_sheet='EVIDENCE_MASTER' AND source_identifier=v;
 IF ev.id IS NULL THEN
  gaps := gaps||jsonb_build_object('gap','Evidence_ID not present in imported master records','value',v);
 ELSE
  INSERT INTO public.relationships(organization_id,source_type,source_id,source_label,relation_type,target_type,target_id,target_label,rule_id,rule_version,status,provenance,created_by)
  VALUES(p.organization_id,'fact',p.id,p.source_label||': '||v,'IDENTIFIES','master_record',ev.id,'EVIDENCE_MASTER '||ev.source_identifier,'R-AGENCY-001','1.0','candidate',jsonb_build_object('basis','Reviewed fact value equals Evidence_ID exactly','fact_locator',p.locator,'master_sheet',ev.source_sheet,'master_row',ev.source_row,'workbook_sha256',ev.source_sha256),auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN made:=made+1; ELSE seen:=seen+1; END IF;
  FOR m IN SELECT * FROM public.master_reference_records WHERE source_sheet='EVIDENCE_REQUIREMENT_MAPPING' AND source_fields->>'Evidence_ID'=ev.source_identifier LOOP
   req := NULL;
   SELECT * INTO req FROM public.master_reference_records WHERE source_sheet='AGENCY_REQUIREMENT_MASTER' AND source_identifier=m.source_fields->>'Requirement_ID';
   IF req.id IS NULL THEN
    gaps := gaps||jsonb_build_object('gap','Mapped requirement not imported','mapping_id',m.source_identifier,'requirement_id',m.source_fields->>'Requirement_ID');
   ELSE
    INSERT INTO public.relationships(organization_id,source_type,source_id,source_label,relation_type,target_type,target_id,target_label,rule_id,rule_version,status,provenance,created_by)
    VALUES(p.organization_id,'master_record',ev.id,'EVIDENCE_MASTER '||ev.source_identifier,'MAPS_TO_REQUIREMENT','master_record',req.id,'AGENCY_REQUIREMENT_MASTER '||req.source_identifier,'R-AGENCY-001','1.0','candidate',jsonb_build_object('basis','Explicit source mapping row','mapping_id',m.source_identifier,'mapping_row',m.source_row,'framework_version',m.source_fields->>'Framework_Version','gate','Held as candidate: framework version and submission approval not established','via_fact',p.id),auth.uid()) ON CONFLICT DO NOTHING;
    IF FOUND THEN made:=made+1; ELSE seen:=seen+1; END IF;
   END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.master_reference_records WHERE source_sheet='EVIDENCE_REQUIREMENT_MAPPING' AND source_fields->>'Evidence_ID'=ev.source_identifier) THEN
   gaps := gaps||jsonb_build_object('gap','No imported explicit mapping for this Evidence_ID','evidence_id',v);
  END IF;
 END IF;
 INSERT INTO public.rule_runs(organization_id,rule_id,rule_version,trigger_event,input_ref,created_count,existing_count,gaps,actor_id) VALUES(p.organization_id,'R-AGENCY-001','1.0','FACT_APPROVED',jsonb_build_object('fact_id',p.id),made,seen,gaps,auth.uid());
END IF;
IF p.canonical_field IS NOT NULL THEN
 made := 0; seen := 0;
 FOR o IN SELECT q.* FROM public.proposed_facts q JOIN public.uploaded_documents a ON a.id=q.document_id JOIN public.uploaded_documents b ON b.id=p.document_id WHERE q.organization_id=p.organization_id AND q.id<>p.id AND q.canonical_field=p.canonical_field AND q.state IN ('approved','corrected') AND q.document_id<>p.document_id AND coalesce(a.reporting_period,'')=coalesce(b.reporting_period,'') AND a.category_code=b.category_code AND lower(btrim(coalesce(q.reviewed_value,q.extracted_value)))<>lower(v) LOOP
  INSERT INTO public.relationships(organization_id,source_type,source_id,source_label,relation_type,target_type,target_id,target_label,rule_id,rule_version,status,provenance,created_by)
  VALUES(p.organization_id,'fact',p.id,p.source_label||': '||v,'CONFLICTS_WITH','fact',o.id,o.source_label||': '||coalesce(o.reviewed_value,o.extracted_value),'R-CONFLICT-001','1.0','candidate',jsonb_build_object('basis','Same field, category and reporting period with different approved values; both preserved'),auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN made:=made+1; ELSE seen:=seen+1; END IF;
 END LOOP;
 INSERT INTO public.rule_runs(organization_id,rule_id,rule_version,trigger_event,input_ref,created_count,existing_count,actor_id) VALUES(p.organization_id,'R-CONFLICT-001','1.0','FACT_APPROVED',jsonb_build_object('fact_id',p.id),made,seen,auth.uid());
END IF;
RETURN jsonb_build_object('gaps',gaps);
END $$;

CREATE FUNCTION public.review_fact(_fact uuid, _decision text, _value text, _note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.proposed_facts; res jsonb:='{}'::jsonb;
BEGIN
SELECT * INTO p FROM public.proposed_facts WHERE id=_fact FOR UPDATE;
IF p.id IS NULL OR NOT public.may_review_facts(p.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF _decision NOT IN ('approve','correct','reject') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
IF p.state NOT IN ('proposed','unresolved_mapping') THEN RAISE EXCEPTION 'Fact already reviewed; decisions are not overwritten'; END IF;
IF _decision<>'reject' AND p.canonical_field IS NULL THEN RAISE EXCEPTION 'Unresolved mapping cannot be approved'; END IF;
IF _decision='correct' AND coalesce(btrim(_value),'')='' THEN RAISE EXCEPTION 'Correction requires a value'; END IF;
IF char_length(coalesce(btrim(_note),''))<5 THEN RAISE EXCEPTION 'A review note is required'; END IF;
INSERT INTO public.fact_reviews(fact_id,organization_id,decision,previous_state,value,note,reviewer_id) VALUES(_fact,p.organization_id,_decision,p.state,CASE WHEN _decision='correct' THEN btrim(_value) END,left(_note,1000),auth.uid());
UPDATE public.proposed_facts SET state=CASE _decision WHEN 'approve' THEN 'approved' WHEN 'correct' THEN 'corrected' ELSE 'rejected' END, reviewed_value=CASE WHEN _decision='correct' THEN btrim(_value) END, reviewer_id=auth.uid(), reviewed_at=now(), review_note=left(_note,1000) WHERE id=_fact;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),p.organization_id,'fact.reviewed','success',jsonb_build_object('fact_id',_fact,'decision',_decision,'field',p.canonical_field));
IF _decision<>'reject' THEN res := public.apply_fact_rules(_fact); END IF;
RETURN res;
END $$;

CREATE FUNCTION public.review_relationship(_rel uuid, _decision text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.relationships;
BEGIN
SELECT * INTO r FROM public.relationships WHERE id=_rel FOR UPDATE;
IF r.id IS NULL OR NOT public.may_review_facts(r.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF r.status<>'candidate' THEN RAISE EXCEPTION 'Only candidate relationships can be reviewed'; END IF;
IF _decision NOT IN ('approved','rejected') OR char_length(coalesce(btrim(_note),''))<5 THEN RAISE EXCEPTION 'Decision and note required'; END IF;
UPDATE public.relationships SET status=_decision, reviewer_id=auth.uid(), reviewed_at=now(), review_note=left(_note,1000) WHERE id=_rel;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),r.organization_id,'relationship.reviewed','success',jsonb_build_object('relationship_id',_rel,'decision',_decision,'rule',r.rule_id,'type',r.relation_type));
END $$;

REVOKE ALL ON FUNCTION public.relationship_endpoint_exists(uuid,text,uuid), public.may_review_facts(uuid), public.begin_processing(uuid), public.complete_processing(uuid,text,text,text,jsonb,jsonb,text), public.apply_fact_rules(uuid), public.review_fact(uuid,text,text,text), public.review_relationship(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.may_review_facts(uuid), public.begin_processing(uuid), public.complete_processing(uuid,text,text,text,jsonb,jsonb,text), public.review_fact(uuid,text,text,text), public.review_relationship(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_fact_rules(uuid), public.relationship_endpoint_exists(uuid,text,uuid) TO service_role;
CREATE INDEX facts_doc ON public.proposed_facts(document_id);
CREATE INDEX segments_doc ON public.document_segments(document_id);
CREATE INDEX rel_org ON public.relationships(organization_id, status);