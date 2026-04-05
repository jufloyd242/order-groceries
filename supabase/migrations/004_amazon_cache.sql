-- ============================================================
-- Migration 004: Amazon product price cache
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Purpose: cache the result of getAmazonProductByAsin (the
-- amazon_product SerpApi engine) for 24 hours so we don't
-- burn SerpApi calls on repeated comparisons of the same item.
--
-- Cache key: ASIN + zip_code (prices are zip-code-scoped).
-- TTL: cached_at + INTERVAL '24 hours'
-- ============================================================

CREATE TABLE IF NOT EXISTS amazon_product_cache (
  asin        TEXT        NOT NULL,
  zip_code    TEXT        NOT NULL DEFAULT '80516',
  -- Serialized ProductMatch fields (all non-null at write time)
  name        TEXT        NOT NULL,
  brand       TEXT        NOT NULL DEFAULT '',
  price       DECIMAL     NOT NULL DEFAULT 0,
  size        TEXT        NOT NULL DEFAULT '',
  unit        TEXT        NOT NULL DEFAULT '',
  price_per_unit DECIMAL  NOT NULL DEFAULT 0,
  image_url   TEXT,
  link        TEXT,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asin, zip_code)
);

-- TTL index: makes queries filtering by cached_at fast
CREATE INDEX IF NOT EXISTS idx_amazon_cache_cached_at
  ON amazon_product_cache (cached_at);

-- Enable RLS (permissive, same pattern as other tables)
ALTER TABLE amazon_product_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_amazon_cache"
  ON amazon_product_cache
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
