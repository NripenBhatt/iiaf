CREATE TABLE public.document_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  source_version text NOT NULL,
  source_hash text NOT NULL,
  model text NOT NULL,
  outputs jsonb NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, source_hash)
);
GRANT SELECT, INSERT ON public.document_outputs TO authenticated;
GRANT ALL ON public.document_outputs TO service_role;
ALTER TABLE public.document_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY outputs_read ON public.document_outputs FOR SELECT TO authenticated USING (public.is_member(organization_id));
CREATE POLICY outputs_insert ON public.document_outputs FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND public.may_upload(organization_id)
  AND EXISTS (SELECT 1 FROM public.uploaded_documents d WHERE d.id = document_id AND d.organization_id = document_outputs.organization_id)
);