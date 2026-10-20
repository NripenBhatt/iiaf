CREATE TABLE public.canonical_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  agency_field_id text NOT NULL,
  requirement_identifier text NOT NULL,
  canonical_field text NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','rejected','superseded')),
  basis text NOT NULL DEFAULT 'internal_interpretation',
  rationale text NOT NULL,
  proposed_by uuid NOT NULL REFERENCES public.profiles(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  reviewer_id uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_note text
);
CREATE INDEX ON public.canonical_field_mappings(organization_id, agency_field_id);
GRANT SELECT ON public.canonical_field_mappings TO authenticated;
GRANT ALL ON public.canonical_field_mappings TO service_role;
ALTER TABLE public.canonical_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfm_read ON public.canonical_field_mappings FOR SELECT TO authenticated USING (public.is_member(organization_id) AND public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[]));

CREATE FUNCTION public.propose_field_mapping(_org uuid, _field text, _canonical text, _rationale text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid text; nid uuid; BEGIN
  IF NOT (public.is_member(_org) AND public.is_operator(ARRAY['super_admin','authorized_operator','internal_reviewer']::public.app_role[])) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF length(coalesce(trim(_rationale),''))<5 THEN RAISE EXCEPTION 'A rationale is required'; END IF;
  SELECT source_fields->>'Requirement_ID' INTO rid FROM public.master_reference_records WHERE source_sheet='AGENCY_FIELD_MASTER' AND source_identifier=_field LIMIT 1;
  IF rid IS NULL THEN RAISE EXCEPTION 'Agency field is not among imported records'; END IF;
  UPDATE public.canonical_field_mappings SET status='superseded' WHERE organization_id=_org AND agency_field_id=_field AND status='candidate';
  INSERT INTO public.canonical_field_mappings(organization_id,agency_field_id,requirement_identifier,canonical_field,rationale,proposed_by) VALUES(_org,_field,rid,_canonical,trim(_rationale),auth.uid()) RETURNING id INTO nid;
  INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),_org,'field_mapping.proposed','success',jsonb_build_object('mapping_id',nid,'field',_field,'canonical',_canonical));
  RETURN nid; END $$;

CREATE FUNCTION public.review_field_mapping(_id uuid, _decision text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.canonical_field_mappings; BEGIN
  SELECT * INTO m FROM public.canonical_field_mappings WHERE id=_id FOR UPDATE;
  IF m.id IS NULL OR NOT (public.is_member(m.organization_id) AND public.is_operator(ARRAY['super_admin','internal_reviewer']::public.app_role[])) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF m.status<>'candidate' THEN RAISE EXCEPTION 'Only candidate mappings can be reviewed'; END IF;
  IF length(coalesce(trim(_note),''))<5 THEN RAISE EXCEPTION 'A review note is required'; END IF;
  IF _decision='approved' THEN UPDATE public.canonical_field_mappings SET status='superseded' WHERE organization_id=m.organization_id AND agency_field_id=m.agency_field_id AND status='approved'; END IF;
  UPDATE public.canonical_field_mappings SET status=_decision, reviewer_id=auth.uid(), reviewed_at=now(), review_note=trim(_note) WHERE id=_id;
  INSERT INTO public.audit_events(actor_id,organization_id,event,outcome,details) VALUES(auth.uid(),m.organization_id,'field_mapping.'||_decision,'success',jsonb_build_object('mapping_id',_id,'field',m.agency_field_id,'canonical',m.canonical_field));
END $$;
REVOKE ALL ON FUNCTION public.propose_field_mapping(uuid,text,text,text), public.review_field_mapping(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_field_mapping(uuid,text,text,text), public.review_field_mapping(uuid,text,text) TO authenticated;

CREATE TABLE public.assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  ui_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, ui_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_threads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_threads, public.assistant_messages TO service_role;
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_threads ON public.assistant_threads FOR ALL TO authenticated USING (user_id=auth.uid() AND public.is_member(organization_id)) WITH CHECK (user_id=auth.uid() AND public.is_member(organization_id));
CREATE POLICY own_messages ON public.assistant_messages FOR ALL TO authenticated USING (user_id=auth.uid() AND public.is_member(organization_id)) WITH CHECK (user_id=auth.uid() AND public.is_member(organization_id) AND EXISTS (SELECT 1 FROM public.assistant_threads t WHERE t.id=thread_id AND t.user_id=auth.uid() AND t.organization_id=assistant_messages.organization_id));