-- ============================================================
-- Migration 006: purchased_at timestamp for staple auto-reset
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Purpose: records exactly when a list item was marked purchased
-- so the GET /api/list route can auto-reset persistent (staple)
-- items that were purchased more than 24 hours ago.
-- ============================================================

ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;
