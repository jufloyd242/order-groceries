-- ============================================================
-- Migration 003: Aisle / Department column on list_items
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS department TEXT;
