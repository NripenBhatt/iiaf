-- Run as service_role in the database query tool. All changes are rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE b public.document_outputs%ROWTYPE; p jsonb; k text; rejected integer:=0; fresh uuid:=gen_random_uuid(); j public.document_processing_jobs%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.document_outputs WHERE document_id='afac6395-6a11-49cd-9d79-84e65ef7206c' AND NOT phase2_quarantined LIMIT 1;
 IF b.id IS NULL OR NOT public.output_source_current(b.document_id,b.organization_id,b.source_version,b.outputs) THEN RAISE EXCEPTION 'Synthetic baseline missing/invalid'; END IF;
 INSERT INTO public.document_outputs(organization_id,document_id,source_version,source_hash,model,outputs,created_by) VALUES(b.organization_id,b.document_id,b.source_version,'rollback-valid','none',b.outputs,b.created_by);
 FOR k IN SELECT unnest(ARRAY['documentId','jobId','originalHash','parserVersion','locators','contractVersion','contractId']) LOOP
  p:=b.outputs;
  IF k='locators' THEN p:=jsonb_set(p,'{outputs,0,manifest,locators}','["forged:locator"]');
  ELSIF k='contractId' THEN p:=jsonb_set(p,'{outputs,0,catalogue,contractId}','"O99"');
  ELSE p:=jsonb_set(p,ARRAY['outputs','0','manifest',k],'"forged"'); END IF;
  BEGIN
   INSERT INTO public.document_outputs(organization_id,document_id,source_version,source_hash,model,outputs,created_by) VALUES(b.organization_id,b.document_id,b.source_version,'rollback-'||k,'none',p,b.created_by);
  EXCEPTION WHEN raise_exception THEN rejected:=rejected+1; END;
 END LOOP;
 IF rejected<>7 THEN RAISE EXCEPTION 'Forged references accepted'; END IF;
 IF public.output_source_current(b.document_id,'75e75fe8-8bfc-4415-8b3e-13b6abf5a429',b.source_version,b.outputs) THEN RAISE EXCEPTION 'Cross-organization accepted'; END IF;
 SELECT * INTO j FROM document_processing_jobs WHERE id=(b.outputs->'outputs'->0->'manifest'->>'jobId')::uuid;
 INSERT INTO document_processing_jobs(id,document_id,organization_id,state,processor,processor_version,segment_count,fact_count,started_by,finished_at) VALUES(fresh,j.document_id,j.organization_id,'processing_failed',j.processor,j.processor_version,0,0,j.started_by,now()+interval '1 minute');
 IF NOT public.output_source_current(b.document_id,b.organization_id,b.source_version,b.outputs) THEN RAISE EXCEPTION 'Failed job staled source'; END IF;
 UPDATE document_processing_jobs SET state='extracted',segment_count=1 WHERE id=fresh;
 IF public.output_source_current(b.document_id,b.organization_id,b.source_version,b.outputs) THEN RAISE EXCEPTION 'Stale source accepted'; END IF;
 IF (SELECT count(*) FROM document_outputs WHERE phase2_quarantined)<>9 OR NOT (SELECT bool_and(phase2_gate->>'before_sha256'=encode(sha256(convert_to(outputs::text,'UTF8')),'hex')) FROM document_outputs WHERE phase2_quarantined) THEN RAISE EXCEPTION 'Quarantine altered'; END IF;
END $$;
ROLLBACK;