CREATE OR REPLACE FUNCTION public.output_source_current(_doc uuid,_org uuid,_version text,_payload jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.uploaded_documents%ROWTYPE; j public.document_processing_jobs%ROWTYPE; x jsonb; m jsonb; keys jsonb; contract text;
BEGIN
 SELECT * INTO d FROM public.uploaded_documents WHERE id=_doc AND organization_id=_org; IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM public.document_processing_jobs WHERE document_id=_doc AND organization_id=_org AND state IN ('extracted','needs_review') AND segment_count>0 ORDER BY finished_at DESC,id DESC LIMIT 1; IF NOT FOUND OR j.processor_version IS DISTINCT FROM _version THEN RETURN false; END IF;
 SELECT jsonb_agg(locator_key ORDER BY seq,id) INTO keys FROM public.document_segments WHERE document_id=_doc AND organization_id=_org AND job_id=j.id;
 IF keys IS NULL OR jsonb_array_length(keys)<>j.segment_count OR jsonb_typeof(_payload->'outputs') IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->'outputs')=0 THEN RETURN false; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(_payload->'outputs') LOOP
  m:=x->'manifest';
  IF m->>'documentId' IS DISTINCT FROM _doc::text OR m->>'jobId' IS DISTINCT FROM j.id::text OR m->>'originalHash' IS DISTINCT FROM d.sha256_hash OR m->>'parserVersion' IS DISTINCT FROM j.processor_version OR m->>'approval' IS DISTINCT FROM 'draft' OR coalesce(m->>'classification','') NOT IN ('DEMO','unverified') OR m->'verifiedCoverage' IS DISTINCT FROM 'false'::jsonb OR m->'locators' IS DISTINCT FROM keys OR coalesce(m->>'contractVersion','') NOT IN ('iiaf-output-2.0','iiaf-output-2.1','iiaf-output-2.2') THEN RETURN false; END IF;
  contract:=CASE x->>'type' WHEN 'extraction_review' THEN 'O13' WHEN 'structured_tables' THEN 'O10' WHEN 'agenda_summary' THEN 'O06' WHEN 'meeting_report' THEN 'O07' WHEN 'decisions' THEN 'O08' WHEN 'action_items' THEN 'O09' ELSE NULL END;
  IF contract IS NULL THEN RETURN false; END IF;
  IF m->>'contractVersion'<>'iiaf-output-2.0' AND (x->'catalogue'->>'contractId' IS DISTINCT FROM contract OR x->'catalogue'->>'support' IS DISTINCT FROM 'source-review') THEN RETURN false; END IF;
  IF x ? 'meeting' THEN
   IF x->'meeting'->>'contractId' IS DISTINCT FROM contract OR x->'meeting'->>'status' IS DISTINCT FROM 'draft' THEN RETURN false; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(x->'meeting'->'records') r WHERE NOT EXISTS(SELECT 1 FROM public.document_segments s WHERE s.job_id=j.id AND s.document_id=_doc AND s.organization_id=_org AND s.locator_key=r->>'locator')) THEN RETURN false; END IF;
  ELSIF contract IN ('O06','O07','O08','O09') THEN RETURN false;
  END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.enforce_output_source_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.phase2_quarantined THEN RAISE EXCEPTION 'Quarantined historical output is immutable'; END IF;
 IF NEW.phase2_quarantined OR NEW.phase2_gate IS NOT NULL OR NOT public.output_source_current(NEW.document_id,NEW.organization_id,NEW.source_version,NEW.outputs) THEN RAISE EXCEPTION 'Output source, job, hash, locators or supported draft contract mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_output_source_integrity BEFORE INSERT OR UPDATE ON public.document_outputs FOR EACH ROW EXECUTE FUNCTION public.enforce_output_source_integrity();
ALTER POLICY outputs_read ON public.document_outputs USING (public.is_member(organization_id) AND NOT phase2_quarantined AND public.output_source_current(document_id,organization_id,source_version,outputs));
COMMENT ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) IS 'RLS-scoped current-source reference validation. Original SHA-256 is bound to uploaded document; source_hash remains an opaque output cache key, not a source identity. Older legitimate draft payloads are retained unchanged. Cannot attest byte-level parser accuracy or semantic truth.';