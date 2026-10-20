ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_outcome_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_outcome_check CHECK (outcome IN ('success','denied','failure'));