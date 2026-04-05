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
  L: 33.814,
  mL: 0.033814,
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
 * Compare prices between Kroger and Amazon for a single item.
 * Selects the best match from each store and determines the winner.
 * If a preference with preferred_upc/preferred_asin exists, use that product.
 */
export function compareItem(
  item: ListItem,
  krogerMatches: ProductMatch[],
  amazonMatches: ProductMatch[],
  preference?: any
): ComparisonResult {
  // If there's a saved preference with a UPC/ASIN, find that product in the results
  let bestKroger: ProductMatch | null = null;
  let bestAmazon: ProductMatch | null = null;

  // Pinned preferences (saved UPC/ASIN): bypass the fuzzy scorer entirely.
  // The user explicitly chose this product, so match_score is irrelevant.
  // Fall back to the top-scored match only if the pinned product isn't present
  // in the result set (e.g. temporarily out of stock).
  if (preference?.preferred_upc) {
    bestKroger =
      krogerMatches.find((p) => p.upc === preference.preferred_upc) ??
      (krogerMatches[0] ?? null);
    // Force score to 100 so the pin is never filtered out downstream
    if (bestKroger) bestKroger = { ...bestKroger, match_score: 100 };
  } else {
    bestKroger = krogerMatches.length > 0 ? krogerMatches[0] : null;
  }

  if (preference?.preferred_asin) {
    bestAmazon =
      amazonMatches.find((p) => p.asin === preference.preferred_asin) ??
      (amazonMatches[0] ?? null);
    if (bestAmazon) bestAmazon = { ...bestAmazon, match_score: 100 };
  } else {
    bestAmazon = amazonMatches.length > 0 ? amazonMatches[0] : null;
  }

  // Calculate effective prices (use promo price if available)
  // Treat $0 prices as unavailable (SerpApi free tier limitation)
  const krogerPrice = bestKroger
    ? (bestKroger.promo_price ?? bestKroger.price) || null
    : null;
  const amazonPrice = bestAmazon
    ? (bestAmazon.promo_price ?? bestAmazon.price) || null
    : null;

  // Price-per-unit values from the adapters (set during product parsing)
  const krogerPPU =
    bestKroger && bestKroger.price_per_unit > 0 ? bestKroger.price_per_unit : null;
  const amazonPPU =
    bestAmazon && bestAmazon.price_per_unit > 0 ? bestAmazon.price_per_unit : null;

  const comparisonUnit = bestKroger?.unit || bestAmazon?.unit || 'each';

  // Use PPU when both stores have it AND use the same unit — gives a fair comparison
  // across different package sizes (e.g., 12oz vs 24oz).
  const unitsMatch =
    !!bestKroger?.unit && !!bestAmazon?.unit &&
    bestKroger.unit.toLowerCase() === bestAmazon.unit.toLowerCase();
  const canComparePPU = krogerPPU !== null && amazonPPU !== null &&
    krogerPrice !== null && amazonPrice !== null && unitsMatch;

  // Determine winner
  let winner: 'kroger' | 'amazon' | 'tie' = 'tie';
  let savings = 0;
  let ppu_winner: 'kroger' | 'amazon' | 'tie' | undefined;
  let savings_note: string | undefined;

  if (canComparePPU) {
    const unit = comparisonUnit;
    // Equalized savings = per-unit difference × reference quantity (size of the losing product)
    if (krogerPPU! < amazonPPU!) {
      winner = 'kroger';
      ppu_winner = 'kroger';
      const diff = amazonPPU! - krogerPPU!;
      const refQty = Math.round(amazonPrice! / amazonPPU!);  // approx qty units in Amazon product
      savings = Math.round(diff * refQty * 100) / 100;
      savings_note = `KS $${krogerPPU!.toFixed(2)}/${unit} · AMZ $${amazonPPU!.toFixed(2)}/${unit}`;
    } else if (amazonPPU! < krogerPPU!) {
      winner = 'amazon';
      ppu_winner = 'amazon';
      const diff = krogerPPU! - amazonPPU!;
      const refQty = Math.round(krogerPrice! / krogerPPU!);  // approx qty units in Kroger product
      savings = Math.round(diff * refQty * 100) / 100;
      savings_note = `AMZ $${amazonPPU!.toFixed(2)}/${unit} · KS $${krogerPPU!.toFixed(2)}/${unit}`;
    } else {
      ppu_winner = 'tie';
      savings_note = `Equal: $${krogerPPU!.toFixed(2)}/${unit}`;
    }
  } else if (krogerPrice !== null && amazonPrice !== null) {
    // Fallback: raw sticker price comparison
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

  return {
    item,
    kroger: krogerMatches,
    amazon: amazonMatches,
    selected_kroger: bestKroger,
    selected_amazon: bestAmazon,
    winner,
    savings,
    ppu_winner,
    savings_note,
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
