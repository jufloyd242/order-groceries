import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NewProductPreference } from '@/types';

/**
 * GET /api/preferences
 * Returns all saved product preferences.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: preferences, error } = await supabase
    .from('product_preferences')
    .select('*')
    .order('generic_name', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    count: preferences?.length || 0,
    preferences: preferences || [],
  });
}

/**
 * POST /api/preferences
 * Create or update a product preference (smart mapping).
 * Body: NewProductPreference
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: NewProductPreference = await request.json();

    if (!body.generic_name || !body.display_name) {
      return NextResponse.json(
        { success: false, error: 'generic_name and display_name are required' },
        { status: 400 }
      );
    }

    const genericKey = body.generic_name.toLowerCase().trim();

    // Use upsert on generic_name which is uniquely indexed
    const { data: updated, error } = await supabase
      .from('product_preferences')
      .upsert({
        generic_name: genericKey,
        display_name: body.display_name,
        preferred_upc: body.preferred_upc ?? null,
        preferred_asin: body.preferred_asin ?? null,
        preferred_store: body.preferred_store ?? null,
        preferred_brand: body.preferred_brand ?? null,
        search_override: body.search_override ?? body.display_name,
      }, { onConflict: 'user_id,generic_name' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      action: 'upserted',
      preference: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/preferences
 * Remove a preference by id.
 * Body: { id: "..." }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('product_preferences').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      removed: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
