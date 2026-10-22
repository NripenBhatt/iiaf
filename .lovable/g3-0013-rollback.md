# G3 — Proposed migration 0013 rollback proof (review artifact, NOT applied)

Status: proposal only. No migration has been applied and none is authorized yet.
This document exists so the rollback path is reviewed before any database change.

## What 0013 would add (proposal)

A database-owned canonical cache-key function for saved output sets, replacing the
runtime `JSON.stringify` winner comparison in `src/lib/output-cache.ts`:

- `public.iiaf_canonical_json(jsonb) returns text` — canonical encoding matching
  `scripts/g3-json-proof.ts` (`iiaf-proof/2:` domain, UTF-8 key order, decimal
  canonicalization). SQL reference: `scripts/g3-json-proof.sql`.
- A generated/stored cache-key column or constraint on the saved-output table
  derived from that function (exact shape fixed only at authorization time).

## Rollback plan (to be reviewed with the forward migration)

```sql
-- Rollback for proposed 0013 (NOT executed):
-- 1. Drop the dependent column/constraint first (exact name fixed at authorization):
--    ALTER TABLE public.<saved_output_table> DROP COLUMN IF EXISTS <cache_key_column>;
-- 2. Drop the function:
--    DROP FUNCTION IF EXISTS public.iiaf_canonical_json(jsonb);
-- 3. Revoke any grants added by 0013:
--    REVOKE ALL ON FUNCTION public.iiaf_canonical_json(jsonb) FROM authenticated, anon, service_role;
```

Rollback safety properties:

- Additive-only forward change: new function + new nullable/generated column.
  No existing column, table, policy or grant is altered, so rollback cannot
  destroy data that predates 0013.
- Runtime fallback: `output-cache.ts` keeps its current `JSON.stringify` winner
  check until the application code switch is separately authorized; after
  rollback the app behaves exactly as before 0013.
- No backfill is required for rollback because the cache key is derivable from
  the stored payload at any time.

## Proof status

- Offline JS canonical encoding: `src/test/g3-json-proof.test.ts` (determinism,
  key-order independence, concurrent-winner equality, type distinction,
  rejection of non-JSON structures).
- Offline SQL parity: `scripts/run-g3-json-parity.ts` against a disposable local
  PostgreSQL cluster — 231/231 vectors exact (run 2026-10-22, local only).
- NOT yet proven: hosted concurrency under real writes, audit trigger behavior,
  compatibility with existing quarantined sets, and the applied rollback itself.
  These require the authorized migration cycle.

## Gate

Do not apply 0013 until: (1) this rollback plan is reviewed, (2) the proof tests
above pass in the authorized cycle, (3) explicit owner authorization is recorded.
