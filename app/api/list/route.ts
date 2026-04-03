import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeItem, buildAbbreviationMap, DEFAULT_ABBREVIATIONS } from '@/lib/matching/normalize';

/**
 * GET /api/list
 * Returns all current shopping list items from Supabase.
 */
export async function GET() {
  const supabase = await createClient();

  const [{ data: items, error }, { data: prefs }] = await Promise.all([
    supabase.from('list_items').select('*').order('created_at', { ascending: true }),
    supabase.from('product_preferences').select('generic_name, display_name, preferred_upc, preferred_asin'),
  ]);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Build a lookup map: generic_name → preference data
  const prefMap = new Map<string, { display_name: string; preferred_upc: string | null; preferred_asin: string | null }>();
  for (const p of (prefs || [])) {
    prefMap.set(p.generic_name.toLowerCase().trim(), {
      display_name: p.display_name,
      preferred_upc: p.preferred_upc ?? null,
      preferred_asin: p.preferred_asin ?? null,
    });
  }

  // Enrich each item with its matched product preference
  const enrichedItems = (items || []).map((item) => {
    const key = (item.normalized_text || item.raw_text).toLowerCase().trim();
    const pref = prefMap.get(key) ?? null;
    return {
      ...item,
      preference: pref,
    };
  });

  return NextResponse.json({
    success: true,
    count: enrichedItems.length,
    items: enrichedItems,
  });
}

/**
 * POST /api/list
 * Add one or more items to the shopping list.
 * Body: { items: [{ raw_text: "milk", source?: "manual" | "todoist", todoist_task_id?: "..." }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const newItems = body.items || [body];

    // Build abbreviation map for normalization
    const abbrevMap = buildAbbreviationMap(DEFAULT_ABBREVIATIONS);

    // Get existing non-purchased items to prevent duplicates.
    // Purchased items are excluded so re-adding them creates a fresh row.
    const { data: existingData } = await supabase
      .from('list_items')
      .select('raw_text')
      .neq('status', 'purchased');
    const existingTexts = existingData ? existingData.map(e => e.raw_text.toLowerCase()) : [];

    const itemsToInsert = [];
    const skipped = [];

    for (const item of newItems) {
      if (!item.raw_text || typeof item.raw_text !== 'string') {
        continue;
      }

      const trimmed = item.raw_text.trim();
      if (!trimmed) continue;

      if (existingTexts.includes(trimmed.toLowerCase())) {
        skipped.push(trimmed);
        continue;
      }

      // Parse quantity, unit, and normalized name from raw text
      const normalized = normalizeItem(trimmed, abbrevMap);

      itemsToInsert.push({
        raw_text: trimmed,
        normalized_text: normalized.normalized_name,
        quantity: normalized.quantity,
        unit: normalized.unit,
        source: item.source || 'manual',
        todoist_task_id: item.todoist_task_id || null,
        status: 'pending',
      });
      existingTexts.push(trimmed.toLowerCase()); // prevent dupes in same batch
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        added: 0,
        skipped: skipped.length,
        items: [],
      });
    }

    const { data: inserted, error } = await supabase
      .from('list_items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      added: inserted?.length || 0,
      skipped: skipped.length,
      items: inserted || [],
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
 * PATCH /api/list
 * Update specific fields of a list item (e.g., quantity, status).
 * Body: { id: "item-id", updates: { quantity: 3, status: "matched" } }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing id or updates' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      item: updated?.[0] || null,
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
 * DELETE /api/list
 * Remove item(s) from the list.
 * Body: { id: "single-id" } or { ids: ["id1", "id2"] } or { clear: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (body.clear === true) {
      // Just delete everything
      const { error } = await supabase.from('list_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return NextResponse.json({ success: true, removed: 'all' });
    }

    const idsToRemove: string[] = body.ids || (body.id ? [body.id] : []);

    if (idsToRemove.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provide id, ids, or clear: true' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('list_items').delete().in('id', idsToRemove);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      removed: idsToRemove.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
