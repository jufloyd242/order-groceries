import { NormalizedItem, QuantityType, Abbreviation } from '@/types';

/**
 * Default abbreviation/synonym dictionary for common grocery shorthand.
 * This is the seed data — users can add custom mappings via settings.
 */
export const DEFAULT_ABBREVIATIONS: Omit<Abbreviation, 'id'>[] = [
  { short_form: 'tp', expansion: 'toilet paper', is_custom: false },
  { short_form: 'oj', expansion: 'orange juice', is_custom: false },
  { short_form: 'evoo', expansion: 'extra virgin olive oil', is_custom: false },
  { short_form: 'chx', expansion: 'chicken', is_custom: false },
  { short_form: 'pb', expansion: 'peanut butter', is_custom: false },
  { short_form: 'pb&j', expansion: 'peanut butter and jelly', is_custom: false },
  { short_form: 'mac', expansion: 'macaroni and cheese', is_custom: false },
  { short_form: 'broc', expansion: 'broccoli', is_custom: false },
  { short_form: 'tom', expansion: 'tomatoes', is_custom: false },
  { short_form: 'toms', expansion: 'tomatoes', is_custom: false },
  { short_form: 'parm', expansion: 'parmesan cheese', is_custom: false },
  { short_form: 'mozz', expansion: 'mozzarella cheese', is_custom: false },
  { short_form: 'ched', expansion: 'cheddar cheese', is_custom: false },
  { short_form: 'gr beef', expansion: 'ground beef', is_custom: false },
  { short_form: 'chx breast', expansion: 'chicken breast', is_custom: false },
  { short_form: 'chx thigh', expansion: 'chicken thighs', is_custom: false },
  { short_form: 'bb', expansion: 'blueberries', is_custom: false },
  { short_form: 'sb', expansion: 'strawberries', is_custom: false },
  { short_form: 'pt', expansion: 'paper towels', is_custom: false },
  { short_form: 'sf', expansion: 'sour cream', is_custom: false },
  { short_form: 'cc', expansion: 'cream cheese', is_custom: false },
  { short_form: 'hw', expansion: 'hot water', is_custom: false },
  { short_form: 'gf', expansion: 'gluten free', is_custom: false },
  { short_form: 'org', expansion: 'organic', is_custom: false },
];

/**
 * Common unit patterns for extraction from grocery item text.
 * Measurement units (cups, tsp, tbsp) come first to take priority over
 * weight/volume units when both could match.
 */
const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string; isMeasurement: boolean; expandable?: boolean }> = [
  // ── Recipe / cooking measurement units (always MEASUREMENT) ──
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(cups?)/i, unit: 'cup', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(tbsp|tablespoons?)/i, unit: 'tbsp', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(tsp|teaspoons?)/i, unit: 'tsp', isMeasurement: true },
  // ── Weight / volume units (MEASUREMENT — buying by weight/volume) ──
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(lbs?|pounds?)/i, unit: 'lb', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(oz|ounces?)/i, unit: 'oz', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(fl\s*oz|fluid\s*ounces?)/i, unit: 'fl oz', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(gal|gallons?)/i, unit: 'gal', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(qt|quarts?)/i, unit: 'qt', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(pt|pints?)/i, unit: 'pt', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(L|liters?|litres?)/i, unit: 'L', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(mL|milliliters?|millilitres?)/i, unit: 'mL', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(g|grams?)/i, unit: 'g', isMeasurement: true },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(kg|kilograms?)/i, unit: 'kg', isMeasurement: true },
  // ── Informal count units (discrete items — triggers row expansion) ──
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(slices?|pieces?|bunch(?:es)?|heads?|stalks?|cloves?|sticks?|loav(?:es)?|loaf|strips?|fillets?|ears?|bags?|box(?:es)?|cans?|jars?|bottles?)\b/i, unit: 'ct', isMeasurement: false, expandable: true },
  // ── Count units (COUNT — discrete packs/items) ──
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(ct|count|pack|pk|rolls?)/i, unit: 'ct', isMeasurement: false },
  { pattern: /(\d+\/\d+|\d+\.?\d*)\s*(doz|dozen)/i, unit: 'dozen', isMeasurement: false },
];

/**
 * Parse a fraction string (e.g. "1/2") or decimal/integer into a number.
 */
function parseFractionOrNumber(str: string): number {
  if (str.includes('/')) {
    const [num, den] = str.split('/');
    const n = parseFloat(num);
    const d = parseFloat(den);
    return d !== 0 ? n / d : 0;
  }
  return parseFloat(str);
}

/**
 * Conversion factors from recipe/grocery units to base units.
 * Weight → oz, Volume → fl oz
 */
const MEASUREMENT_TO_BASE: Record<string, { factor: number; baseUnit: 'oz' | 'fl oz' }> = {
  // Volume → fl oz
  'cup': { factor: 8, baseUnit: 'fl oz' },
  'tbsp': { factor: 0.5, baseUnit: 'fl oz' },
  'tsp': { factor: 0.1667, baseUnit: 'fl oz' },
  'fl oz': { factor: 1, baseUnit: 'fl oz' },
  'gal': { factor: 128, baseUnit: 'fl oz' },
  'qt': { factor: 32, baseUnit: 'fl oz' },
  'pt': { factor: 16, baseUnit: 'fl oz' },
  'L': { factor: 33.814, baseUnit: 'fl oz' },
  'mL': { factor: 0.033814, baseUnit: 'fl oz' },
  // Weight → oz
  'oz': { factor: 1, baseUnit: 'oz' },
  'lb': { factor: 16, baseUnit: 'oz' },
  'g': { factor: 0.03527396, baseUnit: 'oz' },
  'kg': { factor: 35.27396, baseUnit: 'oz' },
};

/**
 * Simple quantity pattern for bare numbers.
 * Handles: "2 plums", "2x plums", "2- plums", "2× plums" → qty=2, name="plums"
 * Requires the digit to be followed by a separator (x, ×, -) or whitespace before the name.
 */
const BARE_QUANTITY_PATTERN = /^(\d+)(?:\s*[x×\-]\s*|\s+)/

/**
 * Singularize a word using common English rules.
 * Only applied to the last word when quantity > 1 (e.g., "plums" → "plum").
 */
function singularize(word: string): string {
  const lower = word.toLowerCase();
  // Don't singularize short words (≤3 chars, e.g. "gas", "bus") — too risky
  if (lower.length <= 3) return word;
  // Irregular plurals
  const irregulars: Record<string, string> = {
    'tomatoes': 'tomato', 'potatoes': 'potato', 'cherries': 'cherry',
    'berries': 'berry', 'strawberries': 'strawberry', 'blueberries': 'blueberry',
    'raspberries': 'raspberry', 'blackberries': 'blackberry', 'cranberries': 'cranberry',
    'leaves': 'leaf', 'loaves': 'loaf', 'halves': 'half', 'knives': 'knife',
    'shelves': 'shelf', 'selves': 'self', 'wives': 'wife', 'lives': 'life',
    'peaches': 'peach', 'bunches': 'bunch', 'radishes': 'radish',
    'squashes': 'squash', 'sandwiches': 'sandwich',
  };
  if (irregulars[lower]) return irregulars[lower];
  // -ies → -y (but not for short words like "dies")
  if (lower.endsWith('ies') && lower.length > 4) return lower.slice(0, -3) + 'y';
  // -ves → -f (e.g., "calves" → "calf")
  if (lower.endsWith('ves')) return lower.slice(0, -3) + 'f';
  // -ches, -shes, -ses, -xes, -zes → drop "es"
  if (/(?:ch|sh|s|x|z)es$/.test(lower)) return lower.slice(0, -2);
  // -s (but not -ss like "grass")
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) return lower.slice(0, -1);
  return word;
}

/**
 * Normalize a raw grocery item string into structured data.
 *
 * Pipeline:
 * 1. Lowercase + expand abbreviations
 * 2. Extract quantity + unit → classify as COUNT or MEASUREMENT
 * 3. For MEASUREMENT: convert to base unit (oz / fl oz) → min_required_amount
 * 4. Clean up remaining text
 */
export function normalizeItem(
  rawText: string,
  abbreviations: Map<string, string>
): NormalizedItem {
  let text = rawText.trim().toLowerCase();

  // Step 1: Expand abbreviations
  // Check whole-string match first, then token-by-token
  if (abbreviations.has(text)) {
    text = abbreviations.get(text)!;
  } else {
    const tokens = text.split(/\s+/);
    const expanded = tokens.map((token) =>
      abbreviations.has(token) ? abbreviations.get(token)! : token
    );
    text = expanded.join(' ');
  }

  // Step 2: Extract quantity and unit
  let quantity: number | null = null;
  let unit: string | null = null;
  let quantityType: QuantityType | null = null;
  let minRequiredAmount: number | null = null;
  let minRequiredUnit: string | null = null;

  for (const { pattern, unit: unitName, isMeasurement } of UNIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      quantity = parseFractionOrNumber(match[1]);
      unit = unitName;
      quantityType = isMeasurement ? 'measurement' : 'count';
      text = text.replace(match[0], '').trim();
      break;
    }
  }

  // If no unit found, check for bare quantity (e.g., "2 milk")
  if (quantity === null) {
    const bareMatch = text.match(BARE_QUANTITY_PATTERN);
    if (bareMatch) {
      quantity = parseInt(bareMatch[1], 10);
      quantityType = 'count'; // bare number = countable items
      text = text.replace(bareMatch[0], '').trim();
    }
  }

  // Enforce whole-number quantity >= 1 for count items
  if (quantity !== null && quantityType !== 'measurement') {
    quantity = Math.max(1, Math.round(quantity));
  }

  // Step 3: For MEASUREMENT quantities, convert to base unit.
  // Also reset quantity to 1 — the user is buying 1 package that satisfies
  // the threshold, not 0.5 of a package (the fraction lives in min_required_amount).
  if (quantityType === 'measurement' && quantity !== null && unit !== null) {
    const conversion = MEASUREMENT_TO_BASE[unit];
    if (conversion) {
      minRequiredAmount = Math.round(quantity * conversion.factor * 10000) / 10000;
      minRequiredUnit = conversion.baseUnit;
    }
    quantity = 1; // always buy 1 (smallest sufficient package)
  }

  // Step 4: Clean up
  let normalized = text
    .replace(/^of\s+/i, '')   // strip leading "of" (e.g., "of swiss cheese" → "swiss cheese")
    .replace(/[^\w\s-]/g, '') // remove special chars except hyphens
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim();

  // Step 5: Always singularize the last word — ensures clean product identity regardless of
  // whether the user typed "plums", "2 plums", "1/2 cup milks", etc. The singularize()
  // function is conservative: short words and non-plural endings are left untouched.
  {
    const words = normalized.split(' ');
    if (words.length > 0) {
      words[words.length - 1] = singularize(words[words.length - 1]);
      normalized = words.join(' ');
    }
  }

  return {
    original: rawText,
    normalized_name: normalized,
    clean_name: normalized,
    quantity,
    unit,
    brand: null, // Brand extraction is a future enhancement
    quantity_type: quantityType,
    min_required_amount: minRequiredAmount,
    min_required_unit: minRequiredUnit,
  };
}

// ─── Product Size Parser ───────────────────────────────────────

/**
 * Parsed size information for a grocery product.
 * totalQty is expressed in the base unit (oz for weight, fl oz for volume, ct for count).
 */
export interface ParsedSize {
  totalQty: number;     // Total quantity in base unit
  baseUnit: string;     // 'oz', 'fl oz', or 'ct'
  displayStr: string;   // Human-readable, e.g. "6 × 12 oz"
  packCount?: number;   // Number of items in a multi-pack
}

// Conversion factors to base units
const WEIGHT_UNIT_TO_OZ: Record<string, number> = {
  oz: 1, lb: 16, lbs: 16, g: 0.03527396, kg: 35.27396,
};
const VOLUME_UNIT_TO_FLOZ: Record<string, number> = {
  'fl oz': 1, gal: 128, qt: 32, pt: 16, l: 33.814, ml: 0.033814,
};

function canonicalUnit(raw: string): string {
  const u = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'fl oz' || u === 'fluid oz' || u === 'fluid ounce' || u === 'fluid ounces') return 'fl oz';
  if (u === 'gallon' || u === 'gallons') return 'gal';
  if (u === 'quart' || u === 'quarts') return 'qt';
  if (u === 'pint' || u === 'pints') return 'pt';
  if (u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
  if (u === 'milliliter' || u === 'milliliters' || u === 'millilitre') return 'ml';
  if (u === 'gram' || u === 'grams') return 'g';
  if (u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'count' || u === 'pk' || u === 'pack' || u === 'packs') return 'ct';
  if (u === 'roll' || u === 'rolls') return 'ct';
  if (u === 'sheet' || u === 'sheets') return 'ct';
  if (u === 'piece' || u === 'pieces') return 'ct';
  if (u === 'dozen' || u === 'doz') return 'dozen';
  return u;
}

function resolveToBaseUnit(qty: number, unit: string): { totalQty: number; baseUnit: string } | null {
  const u = canonicalUnit(unit);
  if (u in WEIGHT_UNIT_TO_OZ) {
    return { totalQty: Math.round(qty * WEIGHT_UNIT_TO_OZ[u] * 10000) / 10000, baseUnit: 'oz' };
  }
  if (u in VOLUME_UNIT_TO_FLOZ) {
    return { totalQty: Math.round(qty * VOLUME_UNIT_TO_FLOZ[u] * 10000) / 10000, baseUnit: 'fl oz' };
  }
  if (u === 'dozen') return { totalQty: qty * 12, baseUnit: 'ct' };
  if (u === 'ct' || u === 'each') return { totalQty: qty, baseUnit: 'ct' };
  return null;
}

// Shared unit group for regex alternation
const UNIT_ALT =
  'oz|lbs?|pounds?|fl\\.?\\s*oz|fluid\\s*oz|gal(?:lons?)?|qt|quarts?|pt|pints?|L|liters?|litres?|mL|milliliters?|g|kg|kilograms?|grams?';
const COUNT_ALT = 'ct|count|packs?|pk|rolls?|sheets?|pieces?|doz(?:en)?';

// Roll-size multipliers: how many "standard rolls" worth of paper each roll type contains.
// Used to estimate total sheets for unit-price comparison (price per 100 sheets).
const ROLL_MULTIPLIERS: Record<string, number> = {
  mega: 2,
  double: 2,
  large: 1.5,
  family: 3,
  jumbo: 2.5,
  super: 2,
  ultra: 2,
  triple: 3,
};
// Estimated sheets per regular/standard roll (Charmin Regular baseline)
const SHEETS_PER_STANDARD_ROLL = 264;

/** Returns estimated total sheet count if the size string describes paper product rolls, else null. */
function estimateSheetCount(sizeStr: string, rollCount: number): number | null {
  const m = sizeStr.match(/\b(mega|double|large|family|jumbo|super|ultra|triple)\b/i);
  if (!m) return null;
  const multiplier = ROLL_MULTIPLIERS[m[1].toLowerCase()] ?? 1;
  return Math.round(rollCount * multiplier * SHEETS_PER_STANDARD_ROLL);
}

/**
 * Parse a product size string into a normalized ParsedSize.
 *
 * Handles:
 * - Simple: "12 oz", "1.5 lb"
 * - Multi-pack multiplier: "6 x 16.9 fl oz", "4×32 oz"
 * - Pack-of: "Pack of 6, 12 oz", "6 pack 12 oz each"
 * - Descriptive count: "12 mega rolls", "24 ct"
 *
 * Returns null if the size string can't be reliably parsed.
 */
export function parseProductSize(sizeStr: string): ParsedSize | null {
  if (!sizeStr || !sizeStr.trim()) return null;
  const s = sizeStr.trim();

  // Pattern 1: Multiplier — "N x M unit" / "N × M unit" / "N*M unit"
  const mulRe = new RegExp(
    `^(\\d+\\.?\\d*)\\s*[x×*]\\s*(\\d+\\.?\\d*)\\s*(${UNIT_ALT})\\b`,
    'i',
  );
  const mulMatch = s.match(mulRe);
  if (mulMatch) {
    const packCount = parseFloat(mulMatch[1]);
    const singleQty = parseFloat(mulMatch[2]);
    const r = resolveToBaseUnit(singleQty, mulMatch[3]);
    if (r) {
      return {
        totalQty: Math.round(packCount * r.totalQty * 1000) / 1000,
        baseUnit: r.baseUnit,
        displayStr: `${packCount} × ${singleQty} ${canonicalUnit(mulMatch[3])}`,
        packCount,
      };
    }
  }

  // Pattern 2: "Pack of N, M unit" or "N pack M unit" or "N ct M unit each"
  const packOfRe = new RegExp(
    `(?:pack\\s+of\\s+(\\d+)[,\\s]+|(\\d+)\\s+(?:pack|ct|count)[,\\s]+)(\\d+\\.?\\d*)\\s*(${UNIT_ALT})\\b`,
    'i',
  );
  const packOfMatch = s.match(packOfRe);
  if (packOfMatch) {
    const packCount = parseFloat(packOfMatch[1] ?? packOfMatch[2]);
    const singleQty = parseFloat(packOfMatch[3]);
    const r = resolveToBaseUnit(singleQty, packOfMatch[4]);
    if (r && packCount > 0) {
      return {
        totalQty: Math.round(packCount * r.totalQty * 1000) / 1000,
        baseUnit: r.baseUnit,
        displayStr: `${packCount} × ${singleQty} ${canonicalUnit(packOfMatch[4])}`,
        packCount,
      };
    }
  }

  // Pattern 3: Simple weight/volume — "12 oz", "1.5 lb", "2 gal"
  const simpleRe = new RegExp(`^(\\d+\\.?\\d*)\\s*(${UNIT_ALT})\\b`, 'i');
  const simpleMatch = s.match(simpleRe);
  if (simpleMatch) {
    const qty = parseFloat(simpleMatch[1]);
    const r = resolveToBaseUnit(qty, simpleMatch[2]);
    if (r) {
      return {
        totalQty: r.totalQty,
        baseUnit: r.baseUnit,
        displayStr: `${qty} ${canonicalUnit(simpleMatch[2])}`,
      };
    }
  }

  // Pattern 4: Count — "12 mega rolls", "24 ct", "6 packs"
  const countRe = new RegExp(
    `^(\\d+)\\s*(?:mega|double|triple|super|ultra)?\\s*(${COUNT_ALT})\\b`,
    'i',
  );
  const countMatch = s.match(countRe);
  if (countMatch) {
    const qty = parseFloat(countMatch[1]);
    const rawUnit = countMatch[2].toLowerCase();
    const isRoll = /roll/.test(rawUnit);
    const r = resolveToBaseUnit(qty, countMatch[2]);
    if (r) {
      if (isRoll) {
        const totalSheets = estimateSheetCount(s, qty);
        if (totalSheets !== null) {
          return {
            totalQty: totalSheets,
            baseUnit: 'ct',
            displayStr: `${qty} rolls ≈ ${totalSheets.toLocaleString()} sheets`,
            packCount: qty,
          };
        }
      }
      return { totalQty: r.totalQty, baseUnit: r.baseUnit, displayStr: `${qty} ct` };
    }
  }

  return null;
}

/**
 * Build an abbreviation lookup map from an array of Abbreviation objects.
 */
export function buildAbbreviationMap(
  abbreviations: Array<{ short_form: string; expansion: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const abbr of abbreviations) {
    map.set(abbr.short_form.toLowerCase(), abbr.expansion.toLowerCase());
  }
  return map;
}
