# Phase 3 implementation batch

Accepted baseline: Phases 1–2. No redesign, provider calls, import, approvals, protected-row changes or migration.

| Gap / cause | Implementation / files | Acceptance / dependency |
|---|---|---|
| Historical memory: requirement-only retrieval lacks general stored-source queries | Shared `knowledge.ts` / `knowledge.functions.ts`; existing Institutional page and company assistant consume the same read-only evidence bundle | Recorded-period search, current extraction citations, gaps and both conflict endpoints; focused tests plus authenticated stored-source readback. True valid-time/correction chains require reviewed schema design. |
| Conflicts: labels alone omit endpoint source/value/period | Preserve both endpoints, review/integrity state and source locators in shared knowledge results; never pick a winner | Synthetic opposite values, missing/foreign endpoints and exact period tests; no automatic resolution |
| Output conflict race: ignored duplicate returns unsaved computed body | `outputs.functions.ts` returns persisted winner only after schema-normalized equality, otherwise explicit conflict | Matching/mismatching/missing winner tests; no new key domain or migration |
| G3 serialization mismatch | Standalone restricted-domain canonical encoding proposal in `scripts/g3-encoding-proof.ts`; not runtime cache replacement | JS vectors only this batch. Integers only: fractional locator/value compatibility is unresolved. SQL parity, nested semantics, hosted concurrency/audit/compatibility and rollback stay unverified until reviewed proof execution; no SQL function or migration added. |
| G6 Q12/Q14 and field bindings | Preserve unresolved dispositions | Owner-reviewed official version/cycle mappings, sensitivity/redaction model and bounded field-binding decisions; no inferred approvals |
| G2 isolation | Existing owner activation workflow; no new account creation | Activate B, assign B-only university role, then separate A/B reads/searches/writes/output sessions |
| OCR | Existing path unchanged, native/OCR distinction retained | Explicit release exclusion or separately authorized resourced transcription acceptance |

Other mandatory gaps: cross-department entity identity, correction/supersession chain, source-change invalidation across derived packages, persistent release/approval governance and complete reliability acceptance require reviewed designs and end-to-end tests. This batch does not claim these complete. Reuse unchanged G1/G4 and Cycle 1 historical evidence. One focused test run and one justified changed-module regression cycle; no full-suite rerun. Phase 3 remains NO-GO until all critical acceptance dependencies close; Phase 4 is not started.