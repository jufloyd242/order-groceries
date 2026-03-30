-- ============================================================
-- Migration 001: Enable Row Level Security (RLS)
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================
-- This is a single-user personal app. RLS is enabled on all
-- tables to prevent direct REST API abuse, but policies allow
-- the anonymous role full access (all data access goes through
-- server-side Next.js API routes, which is the trust boundary).
--
-- If you add multi-user auth later, replace the permissive
-- policies below with user_id-scoped policies and add a
-- user_id column to list_items and product_preferences.
-- ============================================================

-- ─── list_items ──────────────────────────────────────────────
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_list_items"
  ON list_items
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── product_preferences ─────────────────────────────────────
ALTER TABLE product_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_product_preferences"
  ON product_preferences
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── abbreviations ───────────────────────────────────────────
ALTER TABLE abbreviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_abbreviations"
  ON abbreviations
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── price_history ───────────────────────────────────────────
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_price_history"
  ON price_history
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── app_settings ────────────────────────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_app_settings"
  ON app_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
