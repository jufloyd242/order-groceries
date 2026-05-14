-- ============================================================
-- Migration 007: Enable RLS on semantic_cache
-- Run this in: Supabase Dashboard → SQL Editor
--
-- semantic_cache was added in 005 without RLS. This migration
-- brings it in line with all other tables — RLS enabled with a
-- permissive anon/authenticated policy, since all access goes
-- through server-side Next.js API routes (the trust boundary).
-- ============================================================

ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_semantic_cache"
  ON semantic_cache
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
