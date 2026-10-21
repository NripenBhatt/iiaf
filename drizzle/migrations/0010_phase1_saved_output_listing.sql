CREATE INDEX IF NOT EXISTS documents_org_module_created_id ON public.uploaded_documents (organization_id,module,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS outputs_org_created_id ON public.document_outputs (organization_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION public.list_saved_outputs(_org uuid, _filters jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH expanded AS (
 SELECT o.id AS set_id, o.document_id, o.created_at AS generated_at, o.created_by, o.source_hash,o.source_version,d.original_filename,d.module,d.category_code,d.created_at,d.uploaded_at,d.sha256_hash, x.ordinality AS output_index,x.item
 FROM public.document_outputs o JOIN public.uploaded_documents d ON d.id=o.document_id AND d.organization_id=o.organization_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.outputs->'outputs')='array' THEN o.outputs->'outputs' ELSE '[]'::jsonb END) WITH ORDINALITY x(item,ordinality)
 WHERE o.organization_id=_org AND public.is_member(_org)
), filtered AS (
 SELECT *,CASE _filters->>'dateField' WHEN 'uploaded' THEN uploaded_at WHEN 'generated' THEN generated_at ELSE created_at END AS date_value FROM expanded
 WHERE (coalesce(_filters->>'q','')='' OR position(lower(_filters->>'q') IN lower(concat(original_filename,' ',item->>'title',' ',item->>'body')))>0)
 AND (coalesce(_filters->>'module','')='' OR module=_filters->>'module')
 AND (coalesce(_filters->>'category','')='' OR category_code=_filters->>'category')
 AND (coalesce(_filters->>'type','')='' OR item->>'type'=_filters->>'type')
 AND (coalesce(_filters->>'source','')='' OR document_id::text=_filters->>'source')
 AND (coalesce(_filters->>'owner','')='' OR created_by::text=_filters->>'owner')
 AND coalesce(_filters->>'status','') IN ('','draft')
), dated AS (
 SELECT * FROM filtered WHERE (coalesce(_filters->>'from','')='' OR date_value >= ((_filters->>'from')::date::timestamp AT TIME ZONE 'UTC'))
 AND (coalesce(_filters->>'to','')='' OR date_value < (((_filters->>'to')::date+1)::timestamp AT TIME ZONE 'UTC'))
), page AS (
 SELECT * FROM dated ORDER BY
 CASE WHEN _filters->>'sort'='oldest' THEN generated_at END ASC,
 CASE WHEN coalesce(_filters->>'sort','newest')<>'oldest' THEN generated_at END DESC,
 CASE WHEN _filters->>'sort'='oldest' THEN set_id END ASC,
 CASE WHEN coalesce(_filters->>'sort','newest')<>'oldest' THEN set_id END DESC,output_index ASC
 LIMIT 20 OFFSET (greatest(1,least(10000,coalesce((_filters->>'page')::integer,1)))-1)*20
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM dated),'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('setId',set_id,'documentId',document_id,'sourceName',original_filename,'module',module,'category',category_code,'generatedAt',generated_at,'sourceHash',source_hash,'sourceVersion',source_version,'sourceCurrent',source_hash IS NOT NULL AND sha256_hash IS NOT NULL,'index',output_index,'output',item,'status','draft')) FROM page),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.list_saved_outputs(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_saved_outputs(uuid,jsonb) TO authenticated;
COMMENT ON FUNCTION public.list_saved_outputs(uuid,jsonb) IS 'Read-only, RLS-enforced listing of saved draft text outputs. No approval or release inference. Remove endpoint use to roll back application behavior; indexes and helper are additive.';