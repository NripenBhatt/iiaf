CREATE TABLE public.upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  module text NOT NULL CHECK (module IN ('institutional','meeting','evidence')),
  document_ids uuid[] NOT NULL DEFAULT '{}',
  requested_outputs text[] NOT NULL DEFAULT '{}',
  instruction text,
  file_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.upload_batches TO authenticated;
GRANT ALL ON public.upload_batches TO service_role;
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read batches" ON public.upload_batches FOR SELECT TO authenticated USING (public.can_read_org(organization_id));
CREATE POLICY "uploaders record own batches" ON public.upload_batches FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.may_upload(organization_id)
    AND NOT EXISTS (SELECT 1 FROM unnest(document_ids) d WHERE NOT EXISTS (SELECT 1 FROM public.uploaded_documents u WHERE u.id = d AND u.organization_id = upload_batches.organization_id)));