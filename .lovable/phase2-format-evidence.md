# Phase 2 format evidence

All upload extensions remain accepted up to 20 MB. No new dependency/provider. This round uses focused existing extraction tests, additions for cells/URLs/Hindi, and one newly uploaded synthetic CSV.

| Format | Actually exercised this round | Honest capability / limitation |
|---|---|---|
| PDF text | Existing text-policy.pdf | Native page/line text; no reconstructed table geometry |
| DOC | Existing sample.doc | Native text lines; table geometry partial |
| DOCX | Zipped native XML tests including Hindi table/grid span | Paragraph/headings and table row/cell identity; nested tables, vertical merges and embedded images need original review |
| XLSX | Existing XML sample + SheetJS-created workbook | Native raw/display values, percentage/date formatting, cached formula, sheet/row/cell; formulas never evaluated |
| XLS | SheetJS-created BIFF workbook | Native values and exact sheet/cells; no live upload in this round |
| PPTX | Existing zipped presentation/slide fixture | Native slide/paragraph text; table shape/embedded-image OCR remains partial |
| CSV | Quoted/multiline/blank-cell tests + actual synthetic university upload/download | Rows/cells/raw/display/source references; CSV formula injection escaped on export |
| TXT | Existing native text cases and 2,001-line bound | Lines retained with locators; bounded extraction explicitly partial |
| PNG/JPG/JPEG | Existing OCR-routing tests; actual poster stored 183-line result reused | No OCR/model rerun this round. Stored OCR page-level only; not new OCR operational proof |
| Scanned PDF | Existing textless PDF routing test | No paid OCR invocation this round; retained existing OCR implementation |

Table cell shape is not retroactively recoverable from flattened historical extraction. New parser version 1.4.0 applies only to new files or explicitly authorized retries. Missing DBRAU sample files were searched in both bundles and not found; synthetic tests are not substitutes for validating those exact documents.