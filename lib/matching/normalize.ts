import { NormalizedItem, Abbreviation } from '@/types';

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
 * Common unit patterns for extraction from grocery item text
 */
const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string }> = [
  { pattern: /(\d+\.?\d*)\s*(lbs?|pounds?)/i, unit: 'lb' },
  { pattern: /(\d+\.?\d*)\s*(oz|ounces?)/i, unit: 'oz' },
  { pattern: /(\d+\.?\d*)\s*(fl\s*oz|fluid\s*ounces?)/i, unit: 'fl oz' },
  { pattern: /(\d+\.?\d*)\s*(gal|gallons?)/i, unit: 'gal' },
  { pattern: /(\d+\.?\d*)\s*(qt|quarts?)/i, unit: 'qt' },
  { pattern: /(\d+\.?\d*)\s*(pt|pints?)/i, unit: 'pt' },
  { pattern: /(\d+\.?\d*)\s*(L|liters?|litres?)/i, unit: 'L' },
  { pattern: /(\d+\.?\d*)\s*(mL|milliliters?|millilitres?)/i, unit: 'mL' },
  { pattern: /(\d+\.?\d*)\s*(g|grams?)/i, unit: 'g' },
  { pattern: /(\d+\.?\d*)\s*(kg|kilograms?)/i, unit: 'kg' },
  { pattern: /(\d+\.?\d*)\s*(ct|count|pack|pk|rolls?)/i, unit: 'ct' },
  { pattern: /(\d+\.?\d*)\s*(doz|dozen)/i, unit: 'dozen' },
];

/**
 * Simple quantity pattern for bare numbers (e.g., "2 milk" → qty=2)
 */
const BARE_QUANTITY_PATTERN = /^(\d+)\s+/;

/**
 * Normalize a raw grocery item string into structured data.
 *
 * Pipeline:
 * 1. Lowercase
 * 2. Expand abbreviations
 * 3. Extract quantity + unit
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

  for (const { pattern, unit: unitName } of UNIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      quantity = parseFloat(match[1]);
      unit = unitName;
      text = text.replace(match[0], '').trim();
      break;
    }
  }

  // If no unit found, check for bare quantity  (e.g., "2 milk")
  if (quantity === null) {
    const bareMatch = text.match(BARE_QUANTITY_PATTERN);
    if (bareMatch) {
      quantity = parseInt(bareMatch[1], 10);
      text = text.replace(bareMatch[0], '').trim();
    }
  }

  // Step 3: Clean up
  const normalized = text
    .replace(/[^\w\s-]/g, '') // remove special chars except hyphens
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim();

  return {
    original: rawText,
    normalized_name: normalized,
    quantity,
    unit,
    brand: null, // Brand extraction is a future enhancement
  };
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
