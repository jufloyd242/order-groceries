-- ============================================================
-- Migration 005: Groq AI semantic match cache
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Purpose: cache the result of Groq semantic matching so
-- repeated comparisons for the same grocery query (e.g. "milk")
-- skip the LLM call entirely — returning instantly.
--
-- Cache key: (query, store) — grocery semantics are stable;
-- no TTL needed. Purge manually if ever needed:
--   DELETE FROM semantic_cache WHERE created_at < now() - interval '90 days';
-- ============================================================

CREATE TABLE IF NOT EXISTS semantic_cache (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query         TEXT        NOT NULL,             -- normalized (lowercase, trimmed) search query
  store         TEXT        NOT NULL,             -- 'kroger' | 'amazon'
  best_match_id TEXT        NOT NULL,             -- product id chosen by the LLM
  confidence    INT         NOT NULL,             -- 0–100 confidence score
  reasoning     TEXT,                             -- LLM explanation
  total_qty     NUMERIC,                          -- AI-extracted total quantity
  total_qty_unit TEXT,                            -- 'oz', 'fl oz', or 'ct'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (query, store)
);

-- Index for fast lookups by (query, store)
CREATE INDEX IF NOT EXISTS idx_semantic_cache_query_store ON semantic_cache (query, store);
