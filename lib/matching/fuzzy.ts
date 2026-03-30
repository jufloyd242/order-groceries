import Fuse from 'fuse.js';
import { ProductMatch } from '@/types';

/**
 * Score how well a product matches a search query using fuzzy matching.
 *
 * Uses Fuse.js internally. Returns a score from 0-100 where:
 * - 100 = perfect match
 * -  80+ = strong match
 * -  60+ = reasonable match
 * -  <60 = weak match (user should review)
 */
export function scoreMatches(
  query: string,
  products: ProductMatch[]
): ProductMatch[] {
  if (products.length === 0) return [];

  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'brand', weight: 0.3 },
      { name: 'size', weight: 0.2 },
    ],
    includeScore: true,
    threshold: 0.6, // 0 = exact, 1 = match anything
    ignoreLocation: true,
    useExtendedSearch: false,
  });

  const results = fuse.search(query);

  return results.map((result) => ({
    ...result.item,
    // Fuse score is 0 (perfect) to 1 (no match) — invert and scale to 0-100
    match_score: Math.round((1 - (result.score ?? 1)) * 100),
  }));
}

/**
 * Find the best product match for a given query from a list of products.
 * Returns null if no match meets the minimum confidence threshold.
 */
export function findBestMatch(
  query: string,
  products: ProductMatch[],
  minScore: number = 50
): ProductMatch | null {
  const scored = scoreMatches(query, products);
  if (scored.length === 0) return null;

  const best = scored[0];
  return best.match_score >= minScore ? best : null;
}

/**
 * Rank products by a combination of match score and price.
 * Gives preference to products that are both relevant AND cheap.
 */
export function rankByValueAndRelevance(
  query: string,
  products: ProductMatch[]
): ProductMatch[] {
  const scored = scoreMatches(query, products);

  // Sort by: match_score descending, then by effective price ascending
  return scored.sort((a, b) => {
    // Heavily weight relevance, but break ties with price
    const aValue = a.match_score * 100 - (a.promo_price ?? a.price);
    const bValue = b.match_score * 100 - (b.promo_price ?? b.price);
    return bValue - aValue;
  });
}
