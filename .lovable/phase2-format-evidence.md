# Phase 2 format evidence

All upload extensions remain accepted up to 20 MB. Follow-up: 15 valid synthetic files now persist in src/test/fixtures/phase2, with offline generators and provenance README. Existing DOC/PDF reused. No new dependency/provider or model call. 61/61 focused tests pass; automatic build OK at 13:53:53 UTC, 21 October 2026.

| Format | Actually exercised this round | Honest capability / limitation |
|---|---|---|
| PDF text | Existing text-policy.pdf plus saved synthetic-text.pdf | Native page/line text; no reconstructed table geometry |
| DOC | Existing sample.doc | Native text lines; table geometry partial |
| DOCX | Four saved python-docx files: Hindi agenda, minutes, decisions, performance; prior grid-span tests | Paragraph/headings and table row/cell identity, Hindi/blank retained; nested tables, vertical merges and embedded images need original review |
| XLSX | Saved synthetic-performance.xlsx | 142, 83%, 2026-10-13, cached 118, A2-24 formula and blank E2 retained; formulas never evaluated |
| XLS | Saved BIFF synthetic-performance.xls | Same values/date/blank preserved. Fixture writer omits BIFF formula; no claim of XLS formula fidelity or live upload |
| PPTX | Saved real two-slide presentation | Hindi slide 2 paragraph 2 retained; table shape/embedded-image OCR remains partial |
| CSV | Saved synthetic-table.csv and existing multiline tests; prior uploaded synthetic CSV output re-exported under university session | Rows/cells/raw/display/source references; actual DOCX table/CSV/TXT/manifest ZIP inspected, O10 binding present; source cached, no reread |
| TXT | Saved synthetic-labels.txt, existing native text cases and 2,001-line bound | Lines retained with locators; bounded extraction explicitly partial |
| PNG/JPG/JPEG | Valid 1000×700 saved raster posters opened/validated and passed to routing tests | OCR required, no native extraction claim. No fresh OCR invocation or transcription proof |
| Scanned PDF | Saved valid raster-page PDF | OCR page 1 correctly identified, no live OCR invocation |
| Mixed PDF | Saved two-page PDF, native page plus raster page | Page 1 text retained and page 2 identified for OCR; scan transcription not performed |

Table cell shape is not retroactively recoverable from flattened historical extraction. New parser version 1.4.0 applies only to new files or explicitly authorized retries. Missing DBRAU sample files were searched in both bundles and not found; synthetic tests are not substitutes for validating those exact documents.

Catalogue: all 30 OUT-001–OUT-030 source rows and 13 O01–O13 blueprint contracts retained verbatim. Existing variants have explicit reference IDs/support states; unsupported structured/visual/official contracts fail closed. Contract 2.1 exports reference/support in Word/TXT/ZIP manifests. This is catalogue reconciliation, not approved semantic bindings or completed image/video/report generation.