import { NextRequest, NextResponse } from 'next/server';
import { searchProducts as searchKroger } from '@/lib/kroger/products';
import { searchAmazonProducts as searchAmazon } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { ProductMatch } from '@/types';

/**
 * GET /api/search
 * Search for products across Kroger and Amazon in parallel.
 * Query params:
 *   - q: search query (required)
 *   - locationId: Kroger location ID (optional, uses default if not provided)
 *   - zip: zip code for Amazon search (optional, defaults to 80516)
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');
    let locationId = request.nextUrl.searchParams.get('locationId');
    const zip = request.nextUrl.searchParams.get('zip') || '80516';

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

    // Search both stores in parallel — fetch all available results for client-side pagination
    const [krogerProducts, amazonProducts] = await Promise.all([
      searchKroger(trimmedQuery, locationId, 50).catch((err) => {
        console.error(`Kroger search failed for "${trimmedQuery}":`, err);
        return [];
      }),
      searchAmazon(trimmedQuery, zip, 50).catch((err) => {
        console.error(`Amazon search failed for "${trimmedQuery}":`, err);
        return [];
      }),
    ]);

    // Score results with fuzzy matching
    const scoredKroger = scoreMatches(trimmedQuery, krogerProducts);
    const scoredAmazon = scoreMatches(trimmedQuery, amazonProducts);

    // Fall back to unscored results if fuzzy matching is too strict
    const krogerFinal = scoredKroger.length > 0 ? scoredKroger : krogerProducts;
    const amazonFinal = scoredAmazon.length > 0 ? scoredAmazon : amazonProducts;

    // Merge — products already have store field from their mappers
    const allResults: ProductMatch[] = [
      ...krogerFinal,
      ...amazonFinal,
    ];

    // Sort by match score (best first), then by price
    allResults.sort((a, b) => {
      const scoreDiff = (b.match_score ?? 0) - (a.match_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.price ?? 0) - (b.price ?? 0);
    });

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      count: allResults.length,
      kroger_count: krogerFinal.length,
      amazon_count: amazonFinal.length,
      results: allResults,
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
