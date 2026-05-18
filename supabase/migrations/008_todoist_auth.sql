-- ============================================================
-- Migration 008: Todoist Per-User OAuth Storage
-- Stores per-user Todoist OAuth tokens (same pattern as kroger_auth).
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS todoist_auth (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  access_token text NOT NULL,
  refresh_token text,
  expires_at bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: users can only read/write their own row
ALTER TABLE todoist_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own todoist_auth"
  ON todoist_auth
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
