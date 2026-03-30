import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/abbreviations
 * Returns abbreviation dictionary.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: abbreviations, error } = await supabase
      .from('abbreviations')
      .select('*')
      .order('short_form', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      abbreviations: abbreviations || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/abbreviations
 * Upsert abbreviation entry.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { short_form, expansion, is_custom } = body;

    const { data, error } = await supabase
      .from('abbreviations')
      .upsert({ short_form, expansion, is_custom: is_custom ?? true })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, abbreviation: data[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
