import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppSettings } from '@/types';

/**
 * GET /api/settings
 * Returns current app settings.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase.from('app_settings').select('*');

    if (error) throw error;

    const settingsObj = (data || []).reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    // Fill in environment variable defaults if not set in database
    if (!settingsObj.kroger_location_id && process.env.KROGER_DEFAULT_LOCATION_ID) {
      settingsObj.kroger_location_id = process.env.KROGER_DEFAULT_LOCATION_ID;
    }
    if (!settingsObj.default_zip_code && process.env.DEFAULT_ZIP_CODE) {
      settingsObj.default_zip_code = process.env.DEFAULT_ZIP_CODE;
    }

    return NextResponse.json({
      success: true,
      settings: settingsObj as AppSettings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Update app settings.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const updates = Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }));

    // Upsert multiple rows (assuming key is the primary key)
    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'user_id,key' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
