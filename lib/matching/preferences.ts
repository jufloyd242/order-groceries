import { createClient } from '@/lib/supabase/server';
import { ListItem, ProductPreference, ResolvedItem, Abbreviation } from '@/types';
import { normalizeItem, buildAbbreviationMap, DEFAULT_ABBREVIATIONS } from './normalize';

// Staple grocery items that benefit from store-brand query injection.
// When one of these is searched without a saved preference/override, we prepend
// the store's generic brand ("Simple Truth" for Kroger, "365" for Amazon) so
// the search results skew toward cheaper generic products.
const STAPLE_KEYWORDS = [
  'milk', 'eggs', 'egg', 'bread', 'butter', 'cheese', 'pasta', 'rice',
  'flour', 'sugar', 'oil', 'yogurt', 'cream', 'oats', 'cereal', 'beans',
  'salt', 'pepper',
];

/**
 * Resolves a ListItem to a ProductPreference and search query by querying Supabase.
 */
export async function resolveItem(listItem: ListItem): Promise<ResolvedItem> {
  const supabase = await createClient();

  // 1. Get abbreviations and normalize
  const { data: dbAbbreviations, error: abbrError } = await supabase
    .from('abbreviations')
    .select('short_form, expansion');

  let abbreviationsMap: Map<string, string>;
  
  if (abbrError || !dbAbbreviations) {
    abbreviationsMap = buildAbbreviationMap(DEFAULT_ABBREVIATIONS);
  } else {
    abbreviationsMap = buildAbbreviationMap([
      ...DEFAULT_ABBREVIATIONS,
      ...(dbAbbreviations as { short_form: string; expansion: string }[])
    ]);
  }

  const normalized = normalizeItem(listItem.raw_text, abbreviationsMap);

  // Update listItem with normalized text if not already set
  const updatedListItem: ListItem = {
    ...listItem,
    normalized_text: listItem.normalized_text || normalized.normalized_name,
    quantity: listItem.quantity || normalized.quantity,
    unit: listItem.unit || normalized.unit,
  };

  // 2. Fetch preference
  const { data: preference, error: prefError } = await supabase
    .from('product_preferences')
    .select('*')
    .eq('generic_name', normalized.normalized_name)
    .maybeSingle();

  if (prefError || !preference) {
    // No mapping found — check if this is a staple so we inject store-brand queries
    const isStaple = STAPLE_KEYWORDS.some((k) => normalized.normalized_name.includes(k))
      || listItem.raw_text.toLowerCase().includes('generic');

    return {
      listItem: updatedListItem,
      preference: null,
      searchQuery: normalized.normalized_name,
      ...(isStaple ? {
        krogerQuery: `Simple Truth ${normalized.normalized_name}`,
        amazonQuery: `365 ${normalized.normalized_name}`,
      } : {}),
      isNew: true,
    };
  }

  // 3. Known mapping found
  const typedPreference = preference as ProductPreference;
  
  const searchQuery = typedPreference.search_override 
    ? typedPreference.search_override 
    : typedPreference.display_name;

  // Staple check: only inject store-brand queries when there's no explicit search_override
  const isStaple = !typedPreference.search_override && (
    STAPLE_KEYWORDS.some((k) => normalized.normalized_name.includes(k))
    || listItem.raw_text.toLowerCase().includes('generic')
  );

  return {
    listItem: {
      ...updatedListItem,
      preference_id: typedPreference.id,
      status: 'matched'
    },
    preference: typedPreference,
    searchQuery: searchQuery,
    ...(isStaple ? {
      krogerQuery: `Simple Truth ${searchQuery}`,
      amazonQuery: `365 ${searchQuery}`,
    } : {}),
    isNew: false,
  };
}

/**
 * Create a new preference from a user's product selection.
 */
export function buildPreferenceFromSelection(
  genericName: string,
  selectedProduct: {
    name: string;
    brand?: string;
    size?: string;
    store: 'kroger' | 'amazon';
    upc?: string;
    asin?: string;
    price?: number;
  }
): Omit<ProductPreference, 'id' | 'created_at' | 'updated_at' | 'times_purchased'> {
  return {
    generic_name: genericName.toLowerCase().trim(),
    display_name: selectedProduct.name,
    preferred_upc: selectedProduct.upc ?? null,
    preferred_asin: selectedProduct.asin ?? null,
    preferred_store: null, // Compare both stores by default
    preferred_brand: selectedProduct.brand ?? null,
    // Build strict search_override: brand + product name + size for precise API queries
    search_override: buildStrictSearchQuery(selectedProduct.name, selectedProduct.brand, selectedProduct.size),
    last_kroger_price: selectedProduct.store === 'kroger' ? (selectedProduct.price ?? null) : null,
    last_amazon_price: selectedProduct.store === 'amazon' ? (selectedProduct.price ?? null) : null,
  };
}

/**
 * Build a strict search query from product details.
 * Avoids duplicating brand in the query if the name already starts with it.
 * e.g., brand "Kroger", name "Kroger 2% Milk", size "1 gal" → "Kroger 2% Milk 1 gal"
 */
function buildStrictSearchQuery(name: string, brand?: string, size?: string): string {
  const parts: string[] = [];

  // Prepend brand if it's not already the start of the product name
  if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) {
    parts.push(brand);
  }

  parts.push(name);

  if (size) {
    parts.push(size);
  }

  return parts.join(' ').trim();
}
