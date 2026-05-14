import { ComparisonResult, ListItem, ProductMatch } from '@/types';

/**
 * Unit conversion factors — all normalized to a base unit per category.
 * Weight base: ounces (oz)
 * Volume base: fluid ounces (fl oz)
 * Count base: count (ct)
 */
const WEIGHT_TO_OZ: Record<string, number> = {
  oz: 1,
  lb: 16,
  g: 0.03527396,
  kg: 35.27396,
};

const VOLUME_TO_FLOZ: Record<string, number> = {
  'fl oz': 1,
  cup: 8,
  pt: 16,
  qt: 32,
  gal: 128,
  l: 33.814,
  ml: 0.033814,
};

const COUNT_UNITS = new Set(['ct', 'count', 'pack', 'roll', 'dozen', 'sheet']);

/**
 * Convert a price to a standardized price-per-unit for fair comparison.
 */
export function calculatePricePerUnit(
  price: number,
  quantity: number,
  unit: string
): { pricePerUnit: number; standardUnit: string } {
  const lowerUnit = unit.toLowerCase();

  // Weight comparison (normalize to price per oz)
  if (lowerUnit in WEIGHT_TO_OZ) {
    const ozQuantity = quantity * WEIGHT_TO_OZ[lowerUnit];
    return {
      pricePerUnit: Math.round((price / ozQuantity) * 100) / 100,
      standardUnit: 'oz',
    };
  }

  // Volume comparison (normalize to price per fl oz)
  if (lowerUnit in VOLUME_TO_FLOZ) {
    const flozQuantity = quantity * VOLUME_TO_FLOZ[lowerUnit];
    return {
      pricePerUnit: Math.round((price / flozQuantity) * 100) / 100,
      standardUnit: 'fl oz',
    };
  }

  // Count comparison (price per count)
  if (COUNT_UNITS.has(lowerUnit)) {
    const effectiveQty = lowerUnit === 'dozen' ? quantity * 12 : quantity;
    return {
      pricePerUnit: Math.round((price / effectiveQty) * 100) / 100,
      standardUnit: 'ct',
    };
  }

  // Unknown unit — just return raw price
  return {
    pricePerUnit: price,
    standardUnit: unit || 'each',
  };
}

/**
 * Estimate the total volume/weight of a product in base units (oz or fl oz).
 * Returns null if the product's size can't be parsed.
 */
function estimateProductVolume(product: ProductMatch): { totalQty: number; baseUnit: string } | null {
  // Try parsing the product's size string (e.g. "16 oz", "1 gal", "8 fl oz")
  const sizeStr = (product.size || '').toLowerCase();

  // Try weight units
  for (const [unit, factor] of Object.entries(WEIGHT_TO_OZ)) {
    const pattern = new RegExp(`(\\d+\\.?\\d*)\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const match = sizeStr.match(pattern);
    if (match) {
      return { totalQty: parseFloat(match[1]) * factor, baseUnit: 'oz' };
    }
  }

  // Try volume units
  for (const [unit, factor] of Object.entries(VOLUME_TO_FLOZ)) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\d+\\.?\\d*)\\s*${escaped}\\b`, 'i');
    const match = sizeStr.match(pattern);
    if (match) {
      return { totalQty: parseFloat(match[1]) * factor, baseUnit: 'fl oz' };
    }
  }

  // Common aliases not covered above
  const galMatch = sizeStr.match(/(\d+\.?\d*)\s*gal/i);
  if (galMatch) return { totalQty: parseFloat(galMatch[1]) * 128, baseUnit: 'fl oz' };

  return null;
}

/**
 * Filter products to only those meeting a minimum volume/weight threshold.
 * Returns products sorted by total price ascending (smallest sufficient first).
 */
export function filterByThreshold(
  products: ProductMatch[],
  minAmount: number,
  minUnit: string
): ProductMatch[] {
  const sufficient: ProductMatch[] = [];

  for (const product of products) {
    const vol = estimateProductVolume(product);
    if (!vol) {
      // Can't determine volume — include it but don't prioritize
      sufficient.push(product);
      continue;
    }
    // Only compare same base units (oz↔oz, fl oz↔fl oz)
    if (vol.baseUnit !== minUnit) {
      sufficient.push(product); // different unit category — include
      continue;
    }
    if (vol.totalQty >= minAmount) {
      sufficient.push(product);
    }
    // else: product is too small — exclude
  }

  // Sort by total price ascending (smallest sufficient package = best value for the user)
  return sufficient.sort((a, b) => {
    const priceA = (a.promo_price ?? a.price) || Infinity;
    const priceB = (b.promo_price ?? b.price) || Infinity;
    return priceA - priceB;
  });
}

/**
 * Compare prices between Kroger and Amazon for a single item.
 * Selects the best match from each store and determines the winner.
 * If a preference with preferred_upc/preferred_asin exists, use that product.
 *
 * For MEASUREMENT items (e.g. "1/2 cup milk"): applies threshold filtering
 * to exclude products smaller than the required amount, then picks the
 * cheapest sufficient package (not lowest per-unit — avoids 25lb bags).
 */
export function compareItem(
  item: ListItem,
  krogerMatches: ProductMatch[],
  amazonMatches: ProductMatch[],
  preference?: any
): ComparisonResult {
  // ── Threshold pre-filter for MEASUREMENT items ──
  // Exclude products that provide less than the required amount.
  let filteredKroger = krogerMatches;
  let filteredAmazon = amazonMatches;

  if (item.quantity_type === 'measurement' && item.min_required_amount && item.min_required_unit) {
    filteredKroger = filterByThreshold(krogerMatches, item.min_required_amount, item.min_required_unit);
    filteredAmazon = filterByThreshold(amazonMatches, item.min_required_amount, item.min_required_unit);
  }

  // If there's a saved preference with a UPC/ASIN, find that product in the results
  let bestKroger: ProductMatch | null = null;
  let bestAmazon: ProductMatch | null = null;

  // Pinned preferences (saved UPC/ASIN): bypass the fuzzy scorer entirely.
  // The user explicitly chose this product, so match_score is irrelevant.
  // Fall back to the top-scored match only if the pinned product isn't present
  // in the result set (e.g. temporarily out of stock).
  if (preference?.preferred_upc) {
    bestKroger =
      filteredKroger.find((p) => p.upc === preference.preferred_upc) ??
      (filteredKroger[0] ?? null);
    // Force score to 100 so the pin is never filtered out downstream
    if (bestKroger) bestKroger = { ...bestKroger, match_score: 100 };
  } else {
    bestKroger = filteredKroger.length > 0 ? filteredKroger[0] : null;
  }

  if (preference?.preferred_asin) {
    bestAmazon =
      filteredAmazon.find((p) => p.asin === preference.preferred_asin) ??
      (filteredAmazon[0] ?? null);
    if (bestAmazon) bestAmazon = { ...bestAmazon, match_score: 100 };
  } else {
    bestAmazon = filteredAmazon.length > 0 ? filteredAmazon[0] : null;
  }

  // Calculate effective prices (use promo price if available)
  // Treat $0 prices as unavailable (SerpApi free tier limitation)
  const krogerPrice = bestKroger
    ? (bestKroger.promo_price ?? bestKroger.price) || null
    : null;
  const amazonPrice = bestAmazon
    ? (bestAmazon.promo_price ?? bestAmazon.price) || null
    : null;

  // Determine winner
  let winner: 'kroger' | 'amazon' | 'tie' = 'tie';
  let savings = 0;

  if (krogerPrice !== null && amazonPrice !== null) {
    if (krogerPrice < amazonPrice) {
      winner = 'kroger';
      savings = Math.round((amazonPrice - krogerPrice) * 100) / 100;
    } else if (amazonPrice < krogerPrice) {
      winner = 'amazon';
      savings = Math.round((krogerPrice - amazonPrice) * 100) / 100;
    }
  } else if (krogerPrice !== null) {
    winner = 'kroger';
  } else if (amazonPrice !== null) {
    winner = 'amazon';
  }

  // Calculate price per unit for fair comparison
  const krogerPPU =
    bestKroger && bestKroger.price_per_unit > 0
      ? bestKroger.price_per_unit
      : null;
  const amazonPPU =
    bestAmazon && bestAmazon.price_per_unit > 0
      ? bestAmazon.price_per_unit
      : null;

  const comparisonUnit =
    bestKroger?.unit || bestAmazon?.unit || 'each';

  return {
    item,
    kroger: krogerMatches,
    amazon: amazonMatches,
    selected_kroger: bestKroger,
    selected_amazon: bestAmazon,
    winner,
    savings,
    best_fit: item.quantity_type === 'measurement' && !!(item.min_required_amount),
    price_per_unit: {
      kroger: krogerPPU,
      amazon: amazonPPU,
      unit: comparisonUnit,
    },
  };
}

/**
 * Summarize comparison results for the dashboard.
 */
export function summarizeResults(results: ComparisonResult[]): {
  totalItems: number;
  krogerWins: number;
  amazonWins: number;
  ties: number;
  totalSavings: number;
  krogerCartTotal: number;
  amazonCartTotal: number;
} {
  let krogerWins = 0;
  let amazonWins = 0;
  let ties = 0;
  let totalSavings = 0;
  let krogerCartTotal = 0;
  let amazonCartTotal = 0;

  for (const result of results) {
    switch (result.winner) {
      case 'kroger':
        krogerWins++;
        if (result.selected_kroger) {
          krogerCartTotal +=
            result.selected_kroger.promo_price ??
            result.selected_kroger.price;
        }
        break;
      case 'amazon':
        amazonWins++;
        if (result.selected_amazon) {
          amazonCartTotal +=
            result.selected_amazon.promo_price ??
            result.selected_amazon.price;
        }
        break;
      default:
        ties++;
        break;
    }
    totalSavings += result.savings;
  }

  return {
    totalItems: results.length,
    krogerWins,
    amazonWins,
    ties,
    totalSavings: Math.round(totalSavings * 100) / 100,
    krogerCartTotal: Math.round(krogerCartTotal * 100) / 100,
    amazonCartTotal: Math.round(amazonCartTotal * 100) / 100,
  };
}
