# Local OCR evidence — 22 October 2026

Existing Tesseract 5.5.1 and Poppler executables; no installation, gateway call,
dependency, paid service or original-poster rerun. Synthetic fixtures only.
Execution at approximately 01:39:28 UTC. This sandbox path is not integrated
into deployed document processing. Recognition fidelity is PARTIAL.

Reproduction:
```sh
tesseract src/test/fixtures/phase2/synthetic-poster.png stdout -l eng
pdftoppm -f 1 -singlefile -r 200 -png src/test/fixtures/phase2/synthetic-scanned.pdf /tmp/scanned-page1
tesseract /tmp/scanned-page1.png stdout -l eng
```

Image SHA-256: 4f5bd3049ccbdf64d55bc4a3fd22c5c891440c2662dc3f3442044fd5b21e1931
PDF SHA-256: 7528ab35fae1d0a1134231186633f8fd36d555e6269c9c7943e99a0a7f5533

Persisted verbatim image transcription:
```text
SYNTHETIC DEMO - OCR TEST
From 19685 to Enterprises

IIAF Test University A

13 October 2026

10:00 to 16:00 IST

Venue: Synthetic Hall

Not a real event or original poster
```

Persisted verbatim scanned-page transcription:
```text
SYNTHETIC DEMO - OCR TEST
From 10685 to Enterprises

IIAF Test University A

13 October 2026

10:00 to 16:00 IST

Venue: Synthetic Hall

Not a real event or original poster
```

Source title is “From Ideas to Enterprises”; both transcriptions are wrong at
“Ideas”. Institution, date, time, venue and synthetic disclaimer match visually
inspected PNG. No facts or outputs were persisted from these local OCR results.