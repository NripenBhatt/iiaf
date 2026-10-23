-- Apply only on authorized rollback, after disabling authored writes in the app.
-- Restore the exact captured deployed definition, not the historical migration.
DO $rollback$ BEGIN EXECUTE replace(pg_get_functiondef('public.output_source_legacy(uuid,uuid,text,jsonb)'::regprocedure),'FUNCTION public.output_source_legacy(', 'FUNCTION public.output_source_current('); END $rollback$;
DROP POLICY IF EXISTS output_artifact_insert ON storage.objects;
DROP POLICY IF EXISTS output_artifact_read ON storage.objects;
-- Keep authored rows/objects and helper functions for audit; authored rows fail closed.
