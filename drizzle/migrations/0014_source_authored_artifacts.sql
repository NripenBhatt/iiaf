DO $capture$ BEGIN EXECUTE replace(pg_get_functiondef('public.output_source_current(uuid,uuid,text,jsonb)'::regprocedure),'FUNCTION public.output_source_current(', 'FUNCTION public.output_source_legacy('); END $capture$;
REVOKE ALL ON FUNCTION public.output_source_legacy(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.output_source_legacy(uuid,uuid,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.source_event_body(_fields jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE f jsonb; v jsonb:='{}'; parts text[];
BEGIN
 FOR f IN SELECT value FROM jsonb_array_elements(_fields) LOOP v:=v||jsonb_build_object(f->>'role',f->>'value'); END LOOP;
 parts:=ARRAY['A workshop titled “'||(v->>'title')||'” is announced in the source poster'||CASE WHEN v ? 'date' THEN ' with the printed date '||(v->>'date') ELSE '' END||'. Its occurrence has not been independently confirmed.'];
 IF v ? 'subject' THEN parts:=array_append(parts,'The workshop focuses on '||(v->>'subject')||'.'); END IF;
 IF v ? 'audience' THEN parts:=array_append(parts,'The poster describes the programme as “'||(v->>'audience')||'”.'); END IF;
 IF v ? 'venue' THEN parts:=array_append(parts,'The listed venue is '||(v->>'venue')||'.'); END IF;
 IF v ? 'organizer' THEN parts:=array_append(parts,'The source states: “'||(v->>'organizer')||'”.'); END IF;
 IF v ? 'host' THEN parts:=array_append(parts,'It also states: “'||(v->>'host')||'”.'); END IF;
 IF v ? 'facilitator' THEN parts:=array_append(parts,'The conducting arrangement is described as: “'||(v->>'facilitator')||'”.'); END IF;
 parts:=array_append(parts,'Attendance, outcomes and completion are not established by this announcement. This source-backed draft requires human review before release.');
 RETURN array_to_string(parts,E'\n\n');
END $$;
REVOKE ALL ON FUNCTION public.source_event_body(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.source_event_body(jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.output_source_current(_doc uuid,_org uuid,_version text,_payload jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.uploaded_documents%ROWTYPE; j public.document_processing_jobs%ROWTYPE; x jsonb; m jsonb; keys jsonb; f jsonb; c jsonb; field_value text; roles text[]; latest_count integer; a jsonb; actual_size bigint; catalog text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_payload->'outputs') q WHERE q ? 'authored' OR q ? 'artifact') THEN RETURN public.output_source_legacy(_doc,_org,_version,_payload); END IF;
 SELECT * INTO d FROM public.uploaded_documents WHERE id=_doc AND organization_id=_org; IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM public.document_processing_jobs WHERE document_id=_doc AND organization_id=_org ORDER BY started_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR j.state NOT IN ('extracted','needs_review') OR j.segment_count<=0 OR j.processor_version IS DISTINCT FROM _version THEN RETURN false; END IF;
 SELECT jsonb_agg(locator_key ORDER BY seq,id),count(*) INTO keys,latest_count FROM public.document_segments WHERE document_id=_doc AND organization_id=_org AND job_id=j.id;
 IF latest_count<>j.segment_count OR jsonb_typeof(_payload->'outputs') IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->'outputs')=0 THEN RETURN false; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(_payload->'outputs') LOOP
  IF NOT (x ? 'authored') THEN
   IF NOT public.output_source_legacy(_doc,_org,_version,jsonb_build_object('outputs',jsonb_build_array(x))) THEN RETURN false; END IF;
   CONTINUE;
  END IF;
  IF coalesce(x->>'type','') NOT IN ('news_article','newsletter','website_event','press_release','linkedin','facebook','instagram','x_post','institutional_report','evidence_narrative','image_creative') THEN RETURN false; END IF;
  m:=x->'manifest';
  IF m->>'documentId' IS DISTINCT FROM _doc::text OR m->>'jobId' IS DISTINCT FROM j.id::text OR m->>'originalHash' IS DISTINCT FROM d.sha256_hash OR m->>'parserVersion' IS DISTINCT FROM j.processor_version OR m->>'approval' IS DISTINCT FROM 'draft' OR coalesce(m->>'classification','') NOT IN ('DEMO','unverified') OR m->'verifiedCoverage' IS DISTINCT FROM 'false'::jsonb OR m->'locators' IS DISTINCT FROM keys OR m->>'contractVersion' IS DISTINCT FROM 'iiaf-output-2.2' THEN RETURN false; END IF;
  IF x->'authored'->>'version' IS DISTINCT FROM 'source-event-1' OR x->'contract'->>'template' IS DISTINCT FROM 'source-event-1' OR x->'contract'->'approver' IS DISTINCT FROM 'null'::jsonb OR x->'contract'->>'release' IS DISTINCT FROM 'not_authorized' OR x->'catalogue'->>'support' IS DISTINCT FROM 'stored-draft-only' OR x->'catalogue'->'contractId' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
  catalog:=CASE WHEN x->>'type' IN ('linkedin','facebook','instagram','x_post','image_creative') THEN 'OUT-009' WHEN x->>'type' IN ('news_article','website_event','press_release') THEN 'OUT-008' ELSE NULL END;
  IF x->'catalogue'->>'catalogueId' IS DISTINCT FROM catalog THEN RETURN false; END IF;
  IF jsonb_typeof(x->'authored'->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(x->'authored'->'fields')<2 THEN RETURN false; END IF;
  roles:=ARRAY[]::text[];
  FOR f IN SELECT value FROM jsonb_array_elements(x->'authored'->'fields') LOOP
   IF coalesce(f->>'role','') NOT IN ('title','subject','audience','date','venue','organizer','host','facilitator') OR f->>'role'=ANY(roles) OR jsonb_typeof(f->'citations') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'citations')=0 THEN RETURN false; END IF;
   roles:=array_append(roles,f->>'role'); field_value:='';
   FOR c IN SELECT value FROM jsonb_array_elements(f->'citations') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.document_segments s WHERE s.id::text=c->>'segmentId' AND s.document_id=_doc AND s.organization_id=_org AND s.job_id=j.id AND s.locator_key=c->>'locatorKey' AND s.content=c->>'raw') THEN RETURN false; END IF;
    field_value:=field_value||CASE WHEN field_value='' THEN '' ELSE ' ' END||btrim(c->>'raw');
   END LOOP;
   IF f->>'value' IS DISTINCT FROM field_value THEN RETURN false; END IF;
   IF (f->>'role'='title' AND field_value !~* '^(from ideas to|event title\s*:|workshop title\s*:)') OR (f->>'role'='subject' AND field_value !~* '^understanding legal entity formation') OR (f->>'role'='audience' AND field_value !~* '^interactive learning for') OR (f->>'role'='date' AND field_value !~* '^\d{1,2}\s+[a-z]+\s+20\d{2}$') OR (f->>'role'='organizer' AND field_value !~* '^organis?ed by ') OR (f->>'role'='host' AND field_value !~* '^hosted by ') OR (f->>'role'='facilitator' AND field_value !~* '^and conducted by ') THEN RETURN false; END IF;
  END LOOP;
  IF NOT ('title'=ANY(roles)) OR x->>'title' IS DISTINCT FROM (SELECT v->>'value' FROM jsonb_array_elements(x->'authored'->'fields') v WHERE v->>'role'='title') OR x->>'body' IS DISTINCT FROM public.source_event_body(x->'authored'->'fields') THEN RETURN false; END IF;
  IF jsonb_typeof(x->'authored'->'cautions') IS DISTINCT FROM 'array' OR jsonb_array_length(x->'authored'->'cautions')<2 THEN RETURN false; END IF;
  IF (x->>'type'='x_post' AND char_length(x->>'body')>270) OR (x->>'type'='linkedin' AND char_length(x->>'body')>1200) OR (x->>'type'='facebook' AND char_length(x->>'body')>800) THEN RETURN false; END IF;
  IF x->>'type'='image_creative' THEN
   a:=x->'artifact';
   IF a->>'bucket' IS DISTINCT FROM 'institution-documents' OR a->>'mimeType' IS DISTINCT FROM 'image/png' OR a->>'renderer' IS DISTINCT FROM 'iiaf-canvas-1' OR a->>'width' IS DISTINCT FROM '1080' OR a->>'height' IS DISTINCT FROM '1080' OR coalesce(a->>'sha256','') !~ '^[a-f0-9]{64}$' OR a->>'key' IS DISTINCT FROM _org::text||'/'||_doc::text||'/outputs/'||j.id::text||'/'||(a->>'sha256')||'.png' OR x->'contract'->>'mimeType' IS DISTINCT FROM 'image/png' OR x->'contract'->'dimensions' IS DISTINCT FROM '{"width":1080,"height":1080}'::jsonb THEN RETURN false; END IF;
   SELECT (metadata->>'size')::bigint INTO actual_size FROM storage.objects WHERE bucket_id='institution-documents' AND name=a->>'key';
   IF NOT FOUND OR actual_size<1 OR actual_size>5000000 OR actual_size IS DISTINCT FROM (a->>'size')::bigint THEN RETURN false; END IF;
  ELSIF x ? 'artifact' OR x->'contract'->>'mimeType' IS DISTINCT FROM 'text/markdown' OR x->'contract'->'dimensions' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;
  END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) TO authenticated,service_role;
CREATE POLICY output_artifact_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='institution-documents' AND EXISTS (SELECT 1 FROM public.uploaded_documents d JOIN public.document_processing_jobs j ON j.document_id=d.id AND j.organization_id=d.organization_id WHERE public.may_upload(d.organization_id) AND j.state IN ('extracted','needs_review') AND name ~ ('^'||d.organization_id::text||'/'||d.id::text||'/outputs/'||j.id::text||'/[a-f0-9]{64}\.png$')));
CREATE POLICY output_artifact_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='institution-documents' AND EXISTS (SELECT 1 FROM public.uploaded_documents d WHERE public.is_member(d.organization_id) AND name ~ ('^'||d.organization_id::text||'/'||d.id::text||'/outputs/[a-f0-9-]{36}/[a-f0-9]{64}\.png$')));
COMMENT ON FUNCTION public.output_source_current(uuid,uuid,text,jsonb) IS 'Legacy branch preserved exactly. Authored drafts validate source passages and deterministic body, newest-started job, draft restrictions and private artifact metadata; OCR and pixels require human review, no release or verified coverage.';