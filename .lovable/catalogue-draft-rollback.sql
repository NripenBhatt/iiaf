-- Disable new catalogue writes without deleting any source, output or attestation.
REVOKE EXECUTE ON FUNCTION public.save_catalogue_draft(uuid,text,text,jsonb) FROM authenticated;
-- Restore the exact preserved validator. New catalogue drafts remain stored but hidden;
-- legacy article/social/image, extraction and meeting output behavior is unchanged.
DO $restore$ BEGIN EXECUTE replace(pg_get_functiondef('public.output_source_event_v1(uuid,uuid,text,jsonb)'::regprocedure),'FUNCTION public.output_source_event_v1(', 'FUNCTION public.output_source_current('); END $restore$;
-- Reapply 0015's function definitions and EXECUTE grant to resume catalogue support.