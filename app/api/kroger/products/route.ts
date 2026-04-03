import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/kroger/products';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/kroger/products?q=milk&locationId=02900520
 *
 * Proxies product searches to the Kroger API.
 * Keeps the Kroger credentials server-side.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const locationId = searchParams.get('locationId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const brand = searchParams.get('brand') || undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: q' },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: locationId' },
        { status: 400 }
      );
    }

    const products = await searchProducts(query, locationId, limit, brand);

    return NextResponse.json({
      success: true,
      query,
      locationId,
      count: products.length,
      products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kroger product search error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
