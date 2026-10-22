## G6: exact authoritative reconciliation
Supplied `IIAF_Detailed_Concept_Note_v4.docx`, internal title Detailed Concept Note & Product Baseline, **Version 4.0, 21 October 2026**. SHA-256: `7e406cc3e857ef408eab5d4d755ac7891af2c954b0e7439421260e07f9f16eca`. Parsed all 15 pages; independently extracted document.xml text for inspection. No v1.0 substitute used and no app document extraction/OCR job was run.

| Definition | Source and runtime | Result |
|---|---|---|
| Institutional categories/types | v4 Source artefact 6; upload-catalogue.json 25 / 175 | Exact count match, not proof of every field binding. |
| Meeting categories/types | v4 Source artefact 7; upload-catalogue.json 15 / 57 | Exact count match. |
| Guidance | intake-guidance.json 25 institutional / 15 meeting entries | Count match; category-level examples/formats are not full schemas. |
| Institutional fields | v4 cites prior 2,298 estimate and explicitly says parity unverified | No exhaustive field list in v4; exact match/conflict count cannot be calculated from this note. |
| Meeting fields | v4 cites prior 607 estimate and explicitly says parity unverified | Same limitation; do not claim 607 approved runtime bindings. |
| Canonical facts | fact-fields.json 32 rows, 32 unique fields | Reviewed subset only. Do not subtract 32 from each workbook count to invent a gap count. |
| Outputs/contracts | output-reference-catalogue.json 30 outputs / 13 contracts | Catalogue counts reproduced; v4's extensible examples are not one-to-one enumerated contracts. |
| Output mandatory fields | v4 Output contract includes audience/channel/tenant/facts/IDs/qualification/privacy/template/version/MIME/dimensions/DEMO/review/approver/release/errors | Partial runtime coverage. Source manifests and draft safeguards do not implement every field or approval/release workflow. |

v4 delegates exhaustive definitions to the named institutional/meeting catalogues and developer-spec workbooks (source artefacts 6–7), qualification blueprint (9), and companion deep prompt. It does not itself enumerate 2,905 fields or exact official methodology mappings. Existing `.lovable/phase1-requirements-map.md` and `phase2-requirements-map.md` explicitly preserve these gaps. Missing/unknown fields stay unresolved. Rendered image/carousel/video contracts remain BLOCKED; text/script does not satisfy an asset contract. O06–O09 baseline synthetic draft success does not establish broader meeting intelligence reports.

No conflict discovered in the category/type counts. V4 historical defect/test statements are explicitly historical and do not supersede verified G1/G4 repairs. No official mappings/approvals or new field bindings added. G6 source availability is resolved, but exhaustive reconciliation remains PARTIAL pending detailed workbook-level field crosswalk with reproducible match/gap/conflict IDs.

Reproduce counts with Python JSON reads of `upload-catalogue.json` categories/documentTypes, `intake-guidance.json` categories, `fact-fields.json` fields and unique field names, `output-reference-catalogue.json` outputs/contracts. Reconciliation performed 05:02:14 UTC.

