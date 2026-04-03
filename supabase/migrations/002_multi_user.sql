-- ============================================================
-- Migration 002: Multi-User Support
-- Run this in the Supabase Dashboard → SQL Editor
-- AFTER enabling the Google OAuth provider in Authentication → Providers.
-- ============================================================

-- ─── Drop old permissive policies from migration 001 ─────────
DROP POLICY IF EXISTS "anon_all_list_items" ON list_items;
DROP POLICY IF EXISTS "anon_all_product_preferences" ON product_preferences;
DROP POLICY IF EXISTS "anon_all_abbreviations" ON abbreviations;
DROP POLICY IF EXISTS "anon_all_price_history" ON price_history;
DROP POLICY IF EXISTS "anon_all_app_settings" ON app_settings;


-- ─── list_items: add user_id ──────────────────────────────────
ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid();

-- Add persistent column if not yet present (from Phase 6 manual migration)
ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS persistent boolean DEFAULT false;


-- ─── product_preferences: add user_id, fix unique constraint ──
-- Drop the global UNIQUE(generic_name) — preferences are now per-user
ALTER TABLE product_preferences
  DROP CONSTRAINT IF EXISTS product_preferences_generic_name_key;

ALTER TABLE product_preferences
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid();

-- New per-user unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_preferences_user_generic_name'
  ) THEN
    ALTER TABLE product_preferences
      ADD CONSTRAINT product_preferences_user_generic_name UNIQUE (user_id, generic_name);
  END IF;
END$$;


-- ─── abbreviations: add user_id, fix unique constraint ────────
-- Drop the global UNIQUE(short_form) — abbreviations are now per-user
ALTER TABLE abbreviations
  DROP CONSTRAINT IF EXISTS abbreviations_short_form_key;

ALTER TABLE abbreviations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'abbreviations_user_short_form'
  ) THEN
    ALTER TABLE abbreviations
      ADD CONSTRAINT abbreviations_user_short_form UNIQUE (user_id, short_form);
  END IF;
END$$;


-- ─── price_history: add user_id ───────────────────────────────
ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid();


-- ─── app_settings: restructure for per-user storage ──────────
-- The old schema had `key TEXT PRIMARY KEY` (single global KV store).
-- We need a composite key per user. Strategy:
--   1. Clear existing global seed data (app falls back to env vars).
--   2. Drop old PK.
--   3. Add surrogate id PK + user_id column.
--   4. Add UNIQUE (user_id, key) for upsert conflict resolution.

TRUNCATE TABLE app_settings;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_pkey;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid();

UPDATE app_settings SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE app_settings ALTER COLUMN id SET NOT NULL;
ALTER TABLE app_settings ADD PRIMARY KEY (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_settings_user_key'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_user_key UNIQUE (user_id, key);
  END IF;
END$$;


-- ─── kroger_auth: new table (replaces KV hack in app_settings) ─
CREATE TABLE IF NOT EXISTS kroger_auth (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    BIGINT NOT NULL,           -- Unix ms timestamp
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kroger_auth ENABLE ROW LEVEL SECURITY;


-- ─── New per-user RLS policies ────────────────────────────────
CREATE POLICY "user_own_list_items"
  ON list_items FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_product_preferences"
  ON product_preferences FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_abbreviations"
  ON abbreviations FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_price_history"
  ON price_history FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_app_settings"
  ON app_settings FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_kroger_auth"
  ON kroger_auth FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
