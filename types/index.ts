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
  store: 'kroger' | 'amazon';
  upc?: string;        // Kroger UPC
  asin?: string;       // Amazon ASIN
  is_prime?: boolean;   // Amazon Prime eligible
  match_score: number;  // 0-100 fuzzy match confidence
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
  order_modality: 'DELIVERY' | 'PICKUP';
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
