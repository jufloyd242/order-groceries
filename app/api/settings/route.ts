import { NextRequest, NextResponse } from 'next/server';
import { createClient, createRequestClient } from '@/lib/supabase/server';
import { AppSettings } from '@/types';

/**
 * Hardcoded fallback values — mirrors the seed data in supabase/schema.sql.
 * Ensures GET /api/settings always returns a complete object even when
 * app_settings table is empty or partially seeded.
 */
const SETTING_DEFAULTS: Record<string, string> = {
  default_zip_code: process.env.DEFAULT_ZIP_CODE || '80516',
  store_chain: process.env.DEFAULT_STORE_CHAIN || 'King Soopers',
  todoist_project_name: process.env.TODOIST_PROJECT_NAME || 'groceries',
  kroger_location_id: process.env.KROGER_DEFAULT_LOCATION_ID || '',
  kroger_store_name: '',
  order_modality: 'DELIVERY',
  auto_remove_on_cart: 'false',
  retained_items: '',
};

/**
 * GET /api/settings
 * Returns current app settings, falling back to hardcoded defaults for any
 * missing keys so the response shape is always complete.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase.from('app_settings').select('*');

    if (error) throw error;

    // Start from hardcoded defaults, then layer on DB values.
    // This guarantees all required fields are always present.
    const settingsObj: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of (data || [])) {
      settingsObj[row.key] = row.value;
    }

    return NextResponse.json({
      success: true,
      settings: settingsObj as unknown as AppSettings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Update app settings. Accepts any subset of keys; unknown keys are silently ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const updates = Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }));

    if (updates.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // onConflict: 'key' — the table PK is just `key` (no user_id column)
    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });

    if (error) throw error;

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
