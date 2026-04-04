import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/price-history/averages?names=milk,eggs,butter
 *
 * Returns average historical price per product name for the authenticated user.
 * Used by the "Stock Up" badge logic in SearchProductCard.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const names = request.nextUrl.searchParams.get('names');
    if (!names) {
      return NextResponse.json({ success: true, averages: {} });
    }

    const nameList = names.split(',').map((n) => n.trim()).filter(Boolean);
    if (nameList.length === 0) {
      return NextResponse.json({ success: true, averages: {} });
    }

    // Fetch all history rows for these product names (RLS scopes to user)
    const { data, error } = await supabase
      .from('price_history')
      .select('product_name, price')
      .in('product_name', nameList);

    if (error) throw error;

    // Compute AVG per product name in JS (avoids raw SQL, works across all Supabase plans)
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const row of data ?? []) {
      if (!totals[row.product_name]) totals[row.product_name] = { sum: 0, count: 0 };
      totals[row.product_name].sum += row.price;
      totals[row.product_name].count += 1;
    }

    const averages: Record<string, number> = {};
    for (const [name, { sum, count }] of Object.entries(totals)) {
      if (count >= 2) {
        // Only surface averages when we have at least 2 data points
        averages[name] = Math.round((sum / count) * 100) / 100;
      }
    }

    return NextResponse.json({ success: true, averages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
