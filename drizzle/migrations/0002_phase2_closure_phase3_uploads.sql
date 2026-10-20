CREATE OR REPLACE FUNCTION public.finish_master_import(_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE run public.master_import_runs; counts jsonb; total integer; mismatches integer; repeat_ok boolean; BEGIN
SELECT * INTO run FROM public.master_import_runs WHERE id=_run FOR UPDATE;
IF run.id IS NULL OR NOT public.is_member(run.organization_id) OR NOT public.is_operator(ARRAY['super_admin','authorized_operator']::public.app_role[]) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
SELECT count(*) INTO total FROM public.master_import_outcomes WHERE run_id=_run;
SELECT count(*) INTO mismatches FROM public.master_import_outcomes o LEFT JOIN public.master_reference_records t ON t.id=o.target_record_id WHERE o.run_id=_run AND o.target_record_id IS NOT NULL AND o.outcome IN ('inserted','skipped') AND (t.id IS NULL OR t.source_fields IS DISTINCT FROM o.source_fields OR t.source_identifier IS DISTINCT FROM o.source_identifier OR t.source_sheet IS DISTINCT FROM o.source_sheet);
SELECT jsonb_build_object('source_rows',total,'inserted',count(*) FILTER(WHERE outcome='inserted'),'updated',0,
 'skipped',count(*) FILTER(WHERE outcome='skipped'),
 'existing_identical',count(*) FILTER(WHERE outcome='skipped' AND mapping_log->>'disposition' IS DISTINCT FROM 'excluded'),
 'excluded',count(*) FILTER(WHERE outcome='skipped' AND mapping_log->>'disposition'='excluded'),
 'held',count(*) FILTER(WHERE outcome='rejected' AND mapping_log->>'disposition'='held'),
 'rejected_validation',count(*) FILTER(WHERE outcome='rejected' AND mapping_log->>'disposition' IS DISTINCT FROM 'held'),
 'proposed',count(*) FILTER(WHERE mapping_log->>'disposition' NOT IN ('excluded','held')),
 'rejected',count(*) FILTER(WHERE outcome='rejected'),'conflicts',count(*) FILTER(WHERE outcome='conflict'),'readback_mismatches',mismatches) INTO counts FROM public.master_import_outcomes WHERE run_id=_run;
repeat_ok:=run.mode='sample' AND (counts->>'inserted')::integer=0 AND (counts->>'skipped')::integer>0 AND EXISTS(SELECT 1 FROM public.master_import_runs p WHERE p.id<>_run AND p.mode='sample' AND p.state='verified' AND p.source_sha256=run.source_sha256 AND p.expected_rows=run.expected_rows AND NOT EXISTS(SELECT 1 FROM public.master_import_outcomes a WHERE a.run_id=p.id AND NOT EXISTS(SELECT 1 FROM public.master_import_outcomes b WHERE b.run_id=_run AND b.source_sheet=a.source_sheet AND b.source_row=a.source_row AND b.source_fields IS NOT DISTINCT FROM a.source_fields)));
counts:=counts||jsonb_build_object('idempotency_verified',repeat_ok,'expected_rows',run.expected_rows);
UPDATE public.master_import_runs SET state=CASE WHEN total=expected_rows AND mismatches=0 AND (counts->>'conflicts')::integer=0 THEN 'verified' ELSE 'failed' END,completed_at=now(),validation_summary=counts WHERE id=_run;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),run.organization_id,'master_import.finished','success',counts||jsonb_build_object('run_id',_run));RETURN counts;END $$;

UPDATE public.master_import_runs r SET validation_summary = r.validation_summary || s.c FROM (
 SELECT run_id, jsonb_build_object(
  'existing_identical',count(*) FILTER(WHERE outcome='skipped' AND mapping_log->>'disposition' IS DISTINCT FROM 'excluded'),
  'excluded',count(*) FILTER(WHERE outcome='skipped' AND mapping_log->>'disposition'='excluded'),
  'held',count(*) FILTER(WHERE outcome='rejected' AND mapping_log->>'disposition'='held'),
  'rejected_validation',count(*) FILTER(WHERE outcome='rejected' AND mapping_log->>'disposition' IS DISTINCT FROM 'held'),
  'proposed',count(*) FILTER(WHERE mapping_log->>'disposition' NOT IN ('excluded','held'))) c
 FROM public.master_import_outcomes GROUP BY run_id) s WHERE s.run_id=r.id AND r.state<>'running';

CREATE TABLE public.held_record_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 source_sheet text NOT NULL, source_row integer NOT NULL, source_identifier text NOT NULL,
 decision text NOT NULL CHECK (decision IN ('keep_held','source_correction_required','escalate_for_expert_review')),
 explanation text NOT NULL CHECK (char_length(btrim(explanation)) BETWEEN 10 AND 2000),
 reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.held_record_reviews TO authenticated; GRANT ALL ON public.held_record_reviews TO service_role;
ALTER TABLE public.held_record_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY held_review_read ON public.held_record_reviews FOR SELECT TO authenticated USING (public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));
CREATE POLICY held_review_insert ON public.held_record_reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid() AND public.is_member(organization_id) AND public.is_operator(ARRAY['super_admin','internal_reviewer']::public.app_role[]));
CREATE INDEX held_review_row ON public.held_record_reviews(source_sheet, source_row, created_at DESC);
CREATE FUNCTION public.audit_held_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(NEW.reviewer_id,NEW.organization_id,'master_import.held_reviewed','success',jsonb_build_object('review_id',NEW.id,'sheet',NEW.source_sheet,'row',NEW.source_row,'identifier',NEW.source_identifier,'decision',NEW.decision)); RETURN NEW; END $$;
CREATE TRIGGER held_review_audit AFTER INSERT ON public.held_record_reviews FOR EACH ROW EXECUTE FUNCTION public.audit_held_review();

CREATE TABLE public.uploaded_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 upload_id uuid NOT NULL DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 module text NOT NULL CHECK (module IN ('institutional','meeting','evidence')),
 category_code text NOT NULL, document_type_id text NOT NULL DEFAULT 'UNKNOWN',
 declared_purpose text, department_or_owner text, reporting_period text, document_date_raw text, document_version_or_status text, language text,
 original_filename text NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
 file_extension text NOT NULL, declared_mime_type text, detected_mime_type text,
 file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 20971520),
 sha256_hash text NOT NULL CHECK (sha256_hash ~ '^[0-9a-f]{64}$'),
 storage_object_key text NOT NULL UNIQUE,
 processing_status text NOT NULL DEFAULT 'uploading' CHECK (processing_status IN ('uploading','uploaded','validation_failed','upload_failed','awaiting_processing')),
 extraction_status text NOT NULL DEFAULT 'not_started' CHECK (extraction_status = 'not_started'),
 validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
 attempts integer NOT NULL DEFAULT 1,
 schema_version text NOT NULL DEFAULT 'upload-spec-v2.0',
 uploader_id uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), uploaded_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.uploaded_documents TO authenticated; GRANT ALL ON public.uploaded_documents TO service_role;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_read ON public.uploaded_documents FOR SELECT TO authenticated USING (public.is_member(organization_id));
CREATE INDEX uploaded_documents_org ON public.uploaded_documents(organization_id, module, created_at DESC);
CREATE INDEX uploaded_documents_hash ON public.uploaded_documents(organization_id, sha256_hash);

CREATE FUNCTION public.may_upload(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.organization_memberships m ON m.id=r.membership_id WHERE m.user_id=auth.uid() AND m.organization_id=_org AND m.active AND r.role = ANY(ARRAY['super_admin','authorized_operator','university_administrator','registrar','iqac_manager','department_head_dean','faculty_staff_uploader']::public.app_role[])) $$;

CREATE FUNCTION public.register_document(_org uuid, _module text, _category text, _type text, _filename text, _ext text, _mime text, _size bigint, _sha text, _meta jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE did uuid := gen_random_uuid(); dupes jsonb; safe text; BEGIN
IF auth.uid() IS NULL OR NOT public.may_upload(_org) THEN
 RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF lower(_ext) NOT IN ('pdf','docx','doc','xlsx','xls','csv','pptx','txt','jpg','jpeg','png') THEN RAISE EXCEPTION 'Unsupported format' USING ERRCODE='22023'; END IF;
IF _size IS NULL OR _size <= 0 OR _size > 20971520 THEN RAISE EXCEPTION 'File size outside limit' USING ERRCODE='22023'; END IF;
safe := regexp_replace(_filename, '[^A-Za-z0-9._-]+', '_', 'g');
SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',original_filename,'status',processing_status)),'[]'::jsonb) INTO dupes FROM public.uploaded_documents WHERE organization_id=_org AND sha256_hash=lower(_sha) AND processing_status IN ('awaiting_processing','uploaded');
INSERT INTO public.uploaded_documents(id,organization_id,module,category_code,document_type_id,declared_purpose,department_or_owner,reporting_period,document_date_raw,document_version_or_status,language,original_filename,file_extension,declared_mime_type,file_size_bytes,sha256_hash,storage_object_key,uploader_id)
VALUES(did,_org,_module,_category,coalesce(nullif(_type,''),'UNKNOWN'),nullif(_meta->>'declared_purpose',''),nullif(_meta->>'department_or_owner',''),nullif(_meta->>'reporting_period',''),nullif(_meta->>'document_date_raw',''),nullif(_meta->>'document_version_or_status',''),nullif(_meta->>'language',''),_filename,lower(_ext),nullif(_mime,''),_size,lower(_sha),_org::text||'/'||did::text||'/'||safe,auth.uid());
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),_org,'document.upload_started','success',jsonb_build_object('document_id',did,'module',_module,'size',_size,'duplicate_candidates',jsonb_array_length(dupes)));
RETURN jsonb_build_object('id',did,'storage_object_key',_org::text||'/'||did::text||'/'||safe,'duplicates',dupes); END $$;

CREATE FUNCTION public.finalize_document(_id uuid, _sha text, _detected_mime text, _errors jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, storage AS $$ DECLARE d public.uploaded_documents; obj_size bigint; found_obj boolean; nstat text; errs jsonb := coalesce(_errors,'[]'::jsonb); BEGIN
SELECT * INTO d FROM public.uploaded_documents WHERE id=_id FOR UPDATE;
IF d.id IS NULL OR d.uploader_id<>auth.uid() OR NOT public.may_upload(d.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF d.processing_status NOT IN ('uploading','upload_failed') THEN RETURN d.processing_status; END IF;
SELECT true, (o.metadata->>'size')::bigint INTO found_obj, obj_size FROM storage.objects o WHERE o.bucket_id='institution-documents' AND o.name=d.storage_object_key;
IF NOT coalesce(found_obj,false) THEN nstat:='upload_failed'; errs:=errs||'["Stored file not found after upload"]'::jsonb;
ELSIF obj_size IS DISTINCT FROM d.file_size_bytes THEN nstat:='validation_failed'; errs:=errs||'["Stored size differs from selected file"]'::jsonb;
ELSIF lower(_sha) IS DISTINCT FROM d.sha256_hash THEN nstat:='validation_failed'; errs:=errs||'["Stored content fingerprint differs from selected file"]'::jsonb;
ELSIF jsonb_array_length(errs)>0 THEN nstat:='validation_failed';
ELSE nstat:='awaiting_processing'; END IF;
UPDATE public.uploaded_documents SET processing_status=nstat, validation_errors=errs, detected_mime_type=nullif(_detected_mime,''), uploaded_at=CASE WHEN coalesce(found_obj,false) THEN now() END, updated_at=now() WHERE id=_id;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),d.organization_id,'document.upload_finalized',CASE WHEN nstat='awaiting_processing' THEN 'success' ELSE 'failure' END,jsonb_build_object('document_id',_id,'status',nstat,'error_count',jsonb_array_length(errs)));
RETURN nstat; END $$;

CREATE FUNCTION public.mark_document_failed(_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.uploaded_documents; BEGIN
SELECT * INTO d FROM public.uploaded_documents WHERE id=_id FOR UPDATE;
IF d.id IS NULL OR d.uploader_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF d.processing_status NOT IN ('uploading','upload_failed') THEN RETURN; END IF;
UPDATE public.uploaded_documents SET processing_status='upload_failed', validation_errors=jsonb_build_array(left(coalesce(_reason,'Upload failed'),300)), updated_at=now() WHERE id=_id;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),d.organization_id,'document.upload_failed','failure',jsonb_build_object('document_id',_id)); END $$;

CREATE FUNCTION public.retry_document(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.uploaded_documents; BEGIN
SELECT * INTO d FROM public.uploaded_documents WHERE id=_id FOR UPDATE;
IF d.id IS NULL OR d.uploader_id<>auth.uid() OR NOT public.may_upload(d.organization_id) OR d.processing_status<>'upload_failed' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
UPDATE public.uploaded_documents SET processing_status='uploading', attempts=attempts+1, validation_errors='[]'::jsonb, updated_at=now() WHERE id=_id;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),d.organization_id,'document.upload_retried','success',jsonb_build_object('document_id',_id,'attempt',d.attempts+1));
RETURN d.storage_object_key; END $$;

CREATE FUNCTION public.record_document_access(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.uploaded_documents; BEGIN
SELECT * INTO d FROM public.uploaded_documents WHERE id=_id;
IF d.id IS NULL OR NOT public.is_member(d.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),d.organization_id,'document.downloaded','success',jsonb_build_object('document_id',_id)); END $$;

REVOKE ALL ON FUNCTION public.may_upload(uuid), public.register_document(uuid,text,text,text,text,text,text,bigint,text,jsonb), public.finalize_document(uuid,text,text,jsonb), public.mark_document_failed(uuid,text), public.retry_document(uuid), public.record_document_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.may_upload(uuid), public.register_document(uuid,text,text,text,text,text,text,bigint,text,jsonb), public.finalize_document(uuid,text,text,jsonb), public.mark_document_failed(uuid,text), public.retry_document(uuid), public.record_document_access(uuid) TO authenticated;

CREATE POLICY institution_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='institution-documents' AND EXISTS (SELECT 1 FROM public.uploaded_documents d WHERE d.storage_object_key = storage.objects.name AND d.uploader_id = auth.uid() AND d.processing_status IN ('uploading','upload_failed') AND public.may_upload(d.organization_id)));
CREATE POLICY institution_documents_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='institution-documents' AND EXISTS (SELECT 1 FROM public.uploaded_documents d WHERE d.storage_object_key = storage.objects.name AND public.is_member(d.organization_id)));