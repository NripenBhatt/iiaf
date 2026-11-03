CREATE TABLE public.output_draft_attestations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.uploaded_documents(id), organization_id uuid NOT NULL REFERENCES public.organizations(id), job_id uuid NOT NULL REFERENCES public.document_processing_jobs(id), source_version text NOT NULL, payload jsonb NOT NULL, created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.output_draft_attestations TO authenticated;
GRANT ALL ON public.output_draft_attestations TO service_role;
ALTER TABLE public.output_draft_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY draft_attestation_read ON public.output_draft_attestations FOR SELECT TO authenticated USING (public.is_member(organization_id));
DO $capture$ BEGIN EXECUTE replace(pg_get_functiondef('public.output_source_current(uuid,uuid,text,jsonb)'::regprocedure),'FUNCTION public.output_source_current(', 'FUNCTION public.output_source_event_v1('); END $capture$;
REVOKE ALL ON FUNCTION public.output_source_event_v1(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.output_source_event_v1(uuid,uuid,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.output_source_current(_doc uuid,_org uuid,_version text,_payload jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE j public.document_processing_jobs%ROWTYPE; x jsonb; m jsonb; c jsonb; keys jsonb; original text; n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_payload->'outputs') q WHERE q ? 'draft') THEN RETURN public.output_source_event_v1(_doc,_org,_version,_payload); END IF;
 SELECT sha256_hash INTO original FROM public.uploaded_documents WHERE id=_doc AND organization_id=_org; IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM public.document_processing_jobs WHERE document_id=_doc AND organization_id=_org ORDER BY started_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR j.state NOT IN ('extracted','needs_review') OR j.processor_version IS DISTINCT FROM _version THEN RETURN false; END IF;
 SELECT jsonb_agg(locator_key ORDER BY seq,id),count(*) INTO keys,n FROM public.document_segments WHERE document_id=_doc AND organization_id=_org AND job_id=j.id;
 IF n<>j.segment_count OR n=0 THEN RETURN false; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(_payload->'outputs') LOOP
  IF NOT (x ? 'draft') THEN IF NOT public.output_source_event_v1(_doc,_org,_version,jsonb_build_object('outputs',jsonb_build_array(x))) THEN RETURN false; END IF; CONTINUE; END IF;
  m:=x->'manifest';
  IF m->>'documentId' IS DISTINCT FROM _doc::text OR m->>'jobId' IS DISTINCT FROM j.id::text OR m->>'originalHash' IS DISTINCT FROM original OR m->>'parserVersion' IS DISTINCT FROM _version OR m->>'approval' IS DISTINCT FROM 'draft' OR coalesce(m->>'classification','') NOT IN ('DEMO','unverified') OR m->'verifiedCoverage' IS DISTINCT FROM 'false'::jsonb OR m->'locators' IS DISTINCT FROM keys OR m->>'contractVersion' IS DISTINCT FROM 'iiaf-output-2.2' THEN RETURN false; END IF;
  IF x->'draft'->>'version' IS DISTINCT FROM 'catalogue-draft-1' OR x->'contract'->>'template' IS DISTINCT FROM 'catalogue-draft-1' OR x->'contract'->>'release' IS DISTINCT FROM 'not_authorized' OR x->'contract'->'approver' IS DISTINCT FROM 'null'::jsonb OR x->'catalogue'->>'support' IS DISTINCT FROM 'stored-draft-only' OR x->'catalogue'->>'catalogueId' IS DISTINCT FROM x->'draft'->>'handler' OR coalesce(x->'draft'->>'handler','') !~ '^OUT-0(0[1-9]|[12][0-9]|30)$' OR char_length(coalesce(x->>'body',''))=0 OR char_length(x->>'body')>200000 OR jsonb_array_length(x->'draft'->'cautions')<1 OR jsonb_array_length(x->'draft'->'citations')<1 THEN RETURN false; END IF;
  IF x ? 'artifact' OR x->'contract'->>'mimeType' IS DISTINCT FROM 'text/markdown' OR x->'contract'->'dimensions' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
  IF x->'draft'->>'handler' IN ('OUT-016','OUT-017','OUT-018','OUT-019','OUT-020','OUT-021','OUT-022','OUT-024','OUT-025','OUT-030') AND NOT public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]) THEN RETURN false; END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(x->'draft'->'citations') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.document_segments s WHERE s.id::text=c->>'segmentId' AND s.document_id=_doc AND s.organization_id=_org AND s.job_id=j.id AND s.locator_key=c->>'locatorKey' AND s.content=c->>'raw') THEN RETURN false; END IF;
  END LOOP;
 END LOOP;
 RETURN EXISTS(SELECT 1 FROM public.output_draft_attestations a WHERE a.document_id=_doc AND a.organization_id=_org AND a.job_id=j.id AND a.source_version=_version AND a.payload=_payload);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.save_catalogue_draft(_doc uuid,_version text,_hash text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.uploaded_documents%ROWTYPE; j uuid; result uuid;
BEGIN
 SELECT * INTO d FROM public.uploaded_documents WHERE id=_doc; IF NOT FOUND OR auth.uid() IS NULL OR NOT public.may_upload(d.organization_id) THEN RAISE EXCEPTION 'Output save denied'; END IF;
 IF _hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid output hash'; END IF;
 SELECT id INTO j FROM public.document_processing_jobs WHERE document_id=_doc ORDER BY started_at DESC,id DESC LIMIT 1;
 INSERT INTO public.output_draft_attestations(document_id,organization_id,job_id,source_version,payload,created_by) VALUES(_doc,d.organization_id,j,_version,_payload,auth.uid());
 IF NOT public.output_source_current(_doc,d.organization_id,_version,_payload) THEN RAISE EXCEPTION 'Catalogue draft source or contract validation failed'; END IF;
 INSERT INTO public.document_outputs(organization_id,document_id,source_version,source_hash,model,outputs,created_by) VALUES(d.organization_id,_doc,_version,_hash,'none:catalogue-draft-1',_payload,auth.uid()) ON CONFLICT(document_id,source_hash) DO NOTHING RETURNING id INTO result;
 IF result IS NULL THEN SELECT id INTO result FROM public.document_outputs WHERE document_id=_doc AND source_hash=_hash AND outputs=_payload; END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Output winner differs from generated draft'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_catalogue_draft(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_catalogue_draft(uuid,text,text,jsonb) TO authenticated;
COMMENT ON TABLE public.output_draft_attestations IS 'Immutable caller-authorized catalogue draft payloads. No approved evidence, role changes, publication or contact consent is established. Legacy source-event validation remains unchanged.';