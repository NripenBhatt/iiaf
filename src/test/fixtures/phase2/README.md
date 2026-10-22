# Synthetic Phase 2 fixtures

Every file in this folder is newly generated, fictional test data. None is an
original DBRAU document or the user's workshop poster. Missing original files
cannot be reconstructed faithfully from their names.

Regenerate from the project root:

    python3 scripts/create_phase2_fixtures.py
    bun scripts/create_phase2_spreadsheets.ts

The generators use preinstalled tooling and existing project dependencies only.
No model/OCR call, conversion service or network download is used. Tests read
the saved bytes, rather than treating minimal XML fragments as whole files.

- Four DOCX: Hindi agenda, minutes, decisions, institutional admissions/placement
  evidence (the performance fixture belongs to Institutional Information).
- XLSX/XLS: sheet `Performance`; 142, 83%, 2026-10-13, cached total 118 and blanks.
  XLSX formula `A2-24` is retained, never recalculated; BIFF writer may omit formula.
- PPTX: two real slides including Hindi and slide/paragraph source references.
- CSV/TXT: Unicode, blanks, explicit labels, literal formula string.
- Text/scanned/mixed PDF: native text and embedded raster page routing.
- PNG/JPG/JPEG: valid synthetic poster images, tested for OCR routing only.
- Legacy DOC: existing `../sample.doc` reused; it is not a new DBRAU fixture.

Raster routing tests do not prove successful OCR transcription. No fresh OCR
operational claim is made. Existing stored poster extraction is reused elsewhere.

22 October remediation additions: synthetic-nested-tables.docx,
synthetic-vertical-merge.docx and synthetic-embedded-image.docx. These are actual
python-docx packages; the last demonstrates honest omission, not embedded OCR.
The installed sandbox Tesseract/Poppler tools can transcribe the synthetic PNG
and scanned page offline; this is local evidence only, not the deployed gateway
execution path. Local transcription contains an Ideas/19685 error and requires
review. XLS BIFF formulas remain unclaimed.