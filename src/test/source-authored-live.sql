-- Reproducible read-only assertions under an authenticated University A session.
-- The live browser check used the same RPC through the authenticated client.
-- Expected: valid=true; all other columns=false. No writes or source rereading.
SELECT
 public.output_source_current(document_id,organization_id,source_version,outputs) AS valid,
 public.output_source_current(document_id,organization_id,source_version,jsonb_set(outputs,'{outputs,0,body}','"fabricated"')) AS body_tamper,
 public.output_source_current(document_id,organization_id,source_version,jsonb_set(outputs,'{outputs,0,authored,fields,0,citations,0,raw}','"fake"')) AS source_tamper,
 public.output_source_current(document_id,organization_id,source_version,jsonb_set(outputs,'{outputs,0,manifest,verifiedCoverage}','true')) AS coverage_tamper,
 public.output_source_current(document_id,organization_id,source_version,jsonb_set(outputs,'{outputs,0,contract,release}','"approved"')) AS release_tamper,
 public.output_source_current(document_id,organization_id,source_version,jsonb_set(outputs,'{outputs,1,artifact,key}','"wrong.png"')) AS object_tamper,
 public.output_source_current(document_id,'f002e3db-ef32-4bfb-baaa-1a57b1ef50b7',source_version,outputs) AS wrong_tenant,
 public.output_source_current(document_id,organization_id,'wrong',outputs) AS wrong_parser
FROM public.document_outputs WHERE id='23340dc1-8a51-4ae5-bab2-73c39472d3dd';