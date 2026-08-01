import { NextRequest, NextResponse } from 'next/server';
import { searchProducts as searchKroger } from '@/lib/kroger/products';
// import { searchAmazonProducts as searchAmazon } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { ProductMatch } from '@/types';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/search
 * Search for King Soopers products.
 * Query params:
 *   - q: search query (required)
 *   - locationId: Kroger location ID (optional, uses default if not provided)
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const query = request.nextUrl.searchParams.get('q');
    let locationId = request.nextUrl.searchParams.get('locationId');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query required' },
        { status: 400 }
      );
    }

    // Use environment default if no location ID provided
    if (!locationId) {
      locationId = process.env.KROGER_DEFAULT_LOCATION_ID || '04400835';
    }

    const trimmedQuery = query.trim();

    // Search Kroger only
    const krogerProducts = await searchKroger(trimmedQuery, locationId, 50).catch((err) => {
      console.error(`Kroger search failed for "${trimmedQuery}":`, err);
      return [] as ProductMatch[];
    });

    // Score and finalize
    const scoredKroger = scoreMatches(trimmedQuery, krogerProducts);
    const krogerFinal = scoredKroger.length > 0 ? scoredKroger : krogerProducts;

    // Sort by match score, then price
    krogerFinal.sort((a, b) => {
      const scoreDiff = (b.match_score ?? 0) - (a.match_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.price ?? 0) - (b.price ?? 0);
    });

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      count: krogerFinal.length,
      kroger_count: krogerFinal.length,
      amazon_count: 0,
      results: krogerFinal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Search API error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
