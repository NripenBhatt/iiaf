ALTER TABLE public.proposed_facts ADD COLUMN integrity text NOT NULL DEFAULT 'trusted_processor';
UPDATE public.proposed_facts SET integrity='unverified_legacy';
ALTER TABLE public.proposed_facts ADD CONSTRAINT proposed_facts_integrity_check CHECK (integrity IN ('trusted_processor','unverified_legacy'));
COMMENT ON COLUMN public.proposed_facts.integrity IS 'unverified_legacy = written through the deprecated user-callable complete_processing; cannot support an evidence package';

CREATE FUNCTION public.complete_processing_trusted(_actor uuid, _job uuid, _status text, _processor text, _version text, _segments jsonb, _facts jsonb, _error text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE jb public.document_processing_jobs; s jsonb; f jsonb; seg uuid; nseg int:=0; nfact int:=0; nrel int:=0; existing int:=0; r record; ext text;
BEGIN
SELECT * INTO jb FROM public.document_processing_jobs WHERE id=_job FOR UPDATE;
IF jb.id IS NULL OR jb.started_by<>_actor OR jb.state<>'processing' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
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
 INSERT INTO public.proposed_facts(document_id,organization_id,segment_id,source_label,canonical_field,spec_source,extracted_value,state,validation_issues,locator_key,locator,method,method_version,integrity)
 VALUES(jb.document_id,jb.organization_id,seg,f->>'label',f->>'field',f->>'spec',left(f->>'value',2000),CASE WHEN f->>'field' IS NULL THEN 'unresolved_mapping' ELSE 'proposed' END,coalesce(f->'issues','[]'::jsonb),f->>'locator_key',f->'locator',_processor,_version,'trusted_processor')
 ON CONFLICT (document_id,source_label,locator_key,method_version) DO NOTHING;
 IF FOUND THEN nfact:=nfact+1; END IF;
END LOOP;
FOR r IN SELECT p.id,p.source_label,p.locator_key,p.locator,d.original_filename,d.storage_object_key,d.sha256_hash FROM public.proposed_facts p JOIN public.uploaded_documents d ON d.id=p.document_id WHERE p.document_id=jb.document_id LOOP
 INSERT INTO public.relationships(organization_id,source_type,source_id,source_label,relation_type,target_type,target_id,target_label,rule_id,rule_version,status,provenance,created_by)
 VALUES(jb.organization_id,'fact',r.id,r.source_label,'EXTRACTED_FROM','document',jb.document_id,r.original_filename,'R-ENTITY-001','1.0','approved',jsonb_build_object('locator_key',r.locator_key,'locator',r.locator,'storage_object_key',r.storage_object_key,'sha256',r.sha256_hash,'job_id',_job,'method',_processor,'method_version',_version),_actor)
 ON CONFLICT DO NOTHING;
 IF FOUND THEN nrel:=nrel+1; ELSE existing:=existing+1; END IF;
END LOOP;
INSERT INTO public.rule_runs(organization_id,rule_id,rule_version,trigger_event,input_ref,created_count,existing_count,actor_id) VALUES(jb.organization_id,'R-ENTITY-001','1.0','FACT_CREATED',jsonb_build_object('document_id',jb.document_id,'job_id',_job),nrel,existing,_actor);
ext := CASE _status WHEN 'processing_failed' THEN 'failed' WHEN 'ocr_required' THEN 'ocr_required' WHEN 'needs_review' THEN 'needs_review' ELSE 'extracted' END;
UPDATE public.document_processing_jobs SET state=_status, processor=_processor, processor_version=_version, error=left(_error,500), segment_count=(SELECT count(*) FROM public.document_segments WHERE job_id=_job), fact_count=nfact, finished_at=now() WHERE id=_job;
UPDATE public.uploaded_documents SET processing_status=_status, extraction_status=ext, updated_at=now() WHERE id=jb.document_id;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(_actor,jb.organization_id,'document.processing_finished',CASE WHEN _status='processing_failed' THEN 'failure' ELSE 'success' END,jsonb_build_object('document_id',jb.document_id,'job_id',_job,'status',_status,'new_segments',nseg,'new_facts',nfact,'processor',_processor,'version',_version,'trusted',true));
RETURN jsonb_build_object('status',_status,'new_segments',nseg,'new_facts',nfact,'new_relationships',nrel);
END $function$;
REVOKE EXECUTE ON FUNCTION public.complete_processing_trusted(uuid,uuid,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_processing_trusted(uuid,uuid,text,text,text,jsonb,jsonb,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_processing(uuid,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.complete_processing(uuid,text,text,text,jsonb,jsonb,text) IS 'DEPRECATED: replaced by complete_processing_trusted (service role only)';

CREATE TABLE public.evidence_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 requirement_record_id uuid NOT NULL REFERENCES public.master_reference_records(id),
 requirement_identifier text NOT NULL,
 reporting_period text NOT NULL DEFAULT '',
 version integer NOT NULL,
 content jsonb NOT NULL,
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','changes_requested','superseded')),
 certification_status text NOT NULL DEFAULT 'not_available' CHECK (certification_status IN ('not_available')),
 generated_by uuid NOT NULL REFERENCES public.profiles(id),
 generated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, requirement_record_id, reporting_period, version));
GRANT SELECT ON public.evidence_packages TO authenticated; GRANT ALL ON public.evidence_packages TO service_role;
ALTER TABLE public.evidence_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_read ON public.evidence_packages FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE TABLE public.package_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 package_id uuid NOT NULL REFERENCES public.evidence_packages(id),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 decision text NOT NULL CHECK (decision IN ('reviewed','changes_requested')),
 content_sha256 text NOT NULL, note text NOT NULL,
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.package_reviews TO authenticated; GRANT ALL ON public.package_reviews TO service_role;
ALTER TABLE public.package_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_reviews_read ON public.package_reviews FOR SELECT TO authenticated USING (public.is_member(organization_id) OR public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE FUNCTION public.save_evidence_package(_org uuid, _req uuid, _period text, _content jsonb, _sha text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE latest public.evidence_packages; rid text; nid uuid; v int;
BEGIN
IF NOT (public.is_member(_org) AND public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[])) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
SELECT source_identifier INTO rid FROM master_reference_records WHERE id=_req AND source_sheet='AGENCY_REQUIREMENT_MASTER';
IF rid IS NULL THEN RAISE EXCEPTION 'Requirement not found'; END IF;
SELECT * INTO latest FROM evidence_packages WHERE organization_id=_org AND requirement_record_id=_req AND reporting_period=coalesce(_period,'') ORDER BY version DESC LIMIT 1 FOR UPDATE;
IF latest.id IS NOT NULL AND latest.content_sha256=lower(_sha) THEN RETURN jsonb_build_object('id',latest.id,'version',latest.version,'unchanged',true); END IF;
UPDATE evidence_packages SET status='superseded' WHERE organization_id=_org AND requirement_record_id=_req AND reporting_period=coalesce(_period,'') AND status<>'superseded';
v := coalesce(latest.version,0)+1;
INSERT INTO evidence_packages(organization_id,requirement_record_id,requirement_identifier,reporting_period,version,content,content_sha256,generated_by) VALUES(_org,_req,rid,coalesce(_period,''),v,_content,lower(_sha),auth.uid()) RETURNING id INTO nid;
INSERT INTO audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),_org,'package.generated','success',jsonb_build_object('package_id',nid,'requirement',rid,'version',v,'sha256',lower(_sha),'previous_review_invalidated',latest.status='reviewed'));
RETURN jsonb_build_object('id',nid,'version',v,'unchanged',false);
END $$;

CREATE FUNCTION public.review_evidence_package(_pkg uuid, _decision text, _sha text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.evidence_packages;
BEGIN
SELECT * INTO p FROM evidence_packages WHERE id=_pkg FOR UPDATE;
IF p.id IS NULL OR NOT (public.is_member(p.organization_id) AND public.is_operator(ARRAY['super_admin','internal_reviewer']::public.app_role[])) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF p.status='superseded' THEN RAISE EXCEPTION 'Package version is superseded; review the current version'; END IF;
IF p.content_sha256<>lower(_sha) THEN RAISE EXCEPTION 'Content hash does not match the stored package'; END IF;
IF _decision NOT IN ('reviewed','changes_requested') OR char_length(coalesce(btrim(_note),''))<5 THEN RAISE EXCEPTION 'Decision and note required'; END IF;
INSERT INTO package_reviews(package_id,organization_id,decision,content_sha256,note,reviewer_id) VALUES(_pkg,p.organization_id,_decision,p.content_sha256,left(_note,1000),auth.uid());
UPDATE evidence_packages SET status=_decision WHERE id=_pkg;
INSERT INTO audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),p.organization_id,'package.reviewed','success',jsonb_build_object('package_id',_pkg,'decision',_decision,'sha256',p.content_sha256,'version',p.version));
END $$;
REVOKE ALL ON FUNCTION public.save_evidence_package(uuid,uuid,text,jsonb,text), public.review_evidence_package(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_evidence_package(uuid,uuid,text,jsonb,text), public.review_evidence_package(uuid,text,text,text) TO authenticated;