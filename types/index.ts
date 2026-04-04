// Shared TypeScript types for the Smart Grocery Optimizer

// ─── List Items ───────────────────────────────────────────────

export interface ListItem {
  id: string;
  raw_text: string;
  normalized_text: string | null;
  quantity: number | null;
  unit: string | null;
  source: 'manual' | 'todoist';
  todoist_task_id: string | null;
  preference_id: string | null;
  status: 'pending' | 'matched' | 'compared' | 'carted' | 'purchased';
  created_at: string;
}

export interface NewListItem {
  raw_text: string;
  source?: 'manual' | 'todoist';
  todoist_task_id?: string;
}

// ─── Todoist ──────────────────────────────────────────────────

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  is_shared: boolean;
  order: number;
  is_favorite: boolean;
}

export interface TodoistTask {
  id: string;
  project_id: string;
  content: string;
  description: string;
  is_completed: boolean;
  created_at: string;
  priority: number;
  labels: string[];
}

// ─── Products ─────────────────────────────────────────────────

export interface ProductMatch {
  id: string;
  name: string;
  brand: string;
  price: number;
  promo_price: number | null;
  size: string;
  unit: string;
  price_per_unit: number;
  image_url: string | null;
  store: 'kroger' | 'amazon' | 'walmart' | 'instacart';
  upc?: string;         // Kroger UPC
  asin?: string;        // Amazon ASIN
  is_prime?: boolean;   // Amazon Prime eligible
  match_score: number;  // 0-100 fuzzy match confidence
  department?: string | null;  // Kroger product category (e.g. "Dairy")
  link?: string;        // Direct product page URL
}

/**
 * Alias for ProductMatch — the canonical normalized product shape used
 * throughout the aggregator. All store adapters return this type.
 * Introduced for architectural clarity; identical to ProductMatch at runtime.
 */
export type NormalizedProduct = ProductMatch;

// ─── Store Adapter (plug-and-play aggregator) ─────────────────

export interface StoreSearchOptions {
  locationId?: string;
  zipCode?: string;
  limit?: number;
}

export interface StoreSearchAdapter {
  store: ProductMatch['store'];
  search(query: string, options: StoreSearchOptions): Promise<ProductMatch[]>;
}

export interface ComparisonResult {
  item: ListItem;
  kroger: ProductMatch[];
  amazon: ProductMatch[];
  selected_kroger: ProductMatch | null;
  selected_amazon: ProductMatch | null;
  winner: 'kroger' | 'amazon' | 'tie';
  savings: number;
  price_per_unit: {
    kroger: number | null;
    amazon: number | null;
    unit: string;
  };
}

// ─── Normalization ────────────────────────────────────────────

export interface NormalizedItem {
  original: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  brand: string | null;
}

export interface Abbreviation {
  id: string;
  short_form: string;
  expansion: string;
  is_custom: boolean;
}

// ─── Preferences (Smart Product Mapping) ──────────────────────

export interface ProductPreference {
  id: string;
  generic_name: string;            // "apples", "milk", "tp"
  display_name: string;            // "Honeycrisp Apples, 3lb bag"
  preferred_upc: string | null;    // Kroger UPC for exact re-order
  preferred_asin: string | null;   // Amazon ASIN for exact re-order
  preferred_store: 'kroger' | 'amazon' | null;  // null = compare both
  preferred_brand: string | null;
  search_override: string | null;  // Override search query
  last_kroger_price: number | null;
  last_amazon_price: number | null;
  times_purchased: number;
  created_at: string;
  updated_at: string;
}

export interface NewProductPreference {
  generic_name: string;
  display_name: string;
  preferred_upc?: string;
  preferred_asin?: string;
  preferred_store?: 'kroger' | 'amazon';
  preferred_brand?: string;
  search_override?: string;
}

// ─── Resolved Item (after preference lookup) ──────────────────

export interface ResolvedItem {
  listItem: ListItem;
  preference: ProductPreference | null;
  searchQuery: string;      // What to search for in store APIs
  isNew: boolean;           // True = needs user to pick a product
}

// ─── App Settings ─────────────────────────────────────────────

export interface AppSettings {
  default_zip_code: string;
  store_chain: string;
  todoist_project_name: string;
  kroger_location_id: string;
  kroger_store_name?: string;
  order_modality: 'DELIVERY' | 'PICKUP';
  /** When true, adding to cart auto-removes from local list & completes Todoist task */
  auto_remove_on_cart: 'true' | 'false';
  /** Comma-separated generic_names to always retain (never auto-remove) */
  retained_items: string;
}

// ─── Price History ────────────────────────────────────────────

export interface PriceRecord {
  id: string;
  preference_id: string | null;
  product_name: string;
  store: 'kroger' | 'amazon';
  price: number;
  price_per_unit: number | null;
  unit: string | null;
  recorded_at: string;
}

// ─── API Responses ────────────────────────────────────────────

export interface SyncResult {
  added: number;
  skipped: number;
  items: ListItem[];
}

export interface ComparisonSummary {
  totalItems: number;
  krogerWins: number;
  amazonWins: number;
  ties: number;
  totalSavings: number;
  krogerCartTotal: number;
  amazonCartTotal: number;
  unmappedCount: number;
}

export interface CartPushResult {
  store: 'kroger' | 'amazon';
  success: boolean;
  items_added: number;
  items_failed: number;
  errors: string[];
}

// ─── Unified Shopping Cart ────────────────────────────────────

/** Supported store identifiers — extend this union to add new stores */
export type StoreId = 'kroger' | 'amazon' | 'walmart' | 'instacart';

/** A single item in the unified cart */
export interface CartItem {
  /** Unique key: `${store}-${productId}` */
  id: string;
  store: StoreId;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  image_url: string | null;
  size: string;
  upc?: string;
  asin?: string;
  listItemId?: string;
  addedAt: number;
}

/** Cart grouped by store for submission */
export interface CartByStore {
  kroger: CartItem[];
  amazon: CartItem[];
}

/** Result of submitting one store's items */
export interface StoreSubmitResult {
  store: StoreId;
  success: boolean;
  itemsAdded: number;
  itemsFailed: number;
  errors: string[];
  /** If auth is required (e.g. Kroger OAuth), provide redirect URL */
  authUrl?: string;
}

/** Full cart submission result */
export interface CartSubmitResult {
  results: StoreSubmitResult[];
  submittedIds: string[];
}

// ─── Store Service Interface ──────────────────────────────────

/**
 * Interface each store's cart service must implement.
 * Adding Amazon later = implement this interface.
 */
export interface StoreCartService {
  readonly storeId: StoreId;
  submit(items: CartItem[]): Promise<StoreSubmitResult>;
}
