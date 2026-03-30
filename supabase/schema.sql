-- ============================================================
-- Smart Grocery Optimizer — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Product preferences: the "learn once, auto-select forever" memory
CREATE TABLE IF NOT EXISTS product_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  preferred_upc TEXT,
  preferred_asin TEXT,
  preferred_store TEXT,
  preferred_brand TEXT,
  search_override TEXT,
  last_kroger_price DECIMAL,
  last_amazon_price DECIMAL,
  times_purchased INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(generic_name)
);

-- Shopping list items
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  normalized_text TEXT,
  quantity DECIMAL DEFAULT 1,
  unit TEXT,
  source TEXT DEFAULT 'manual',
  todoist_task_id TEXT,
  preference_id UUID REFERENCES product_preferences(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Abbreviation dictionary
CREATE TABLE IF NOT EXISTS abbreviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_form TEXT UNIQUE NOT NULL,
  expansion TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT false
);

-- Price history for trend tracking
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_id UUID REFERENCES product_preferences(id),
  product_name TEXT NOT NULL,
  store TEXT NOT NULL,
  price DECIMAL NOT NULL,
  price_per_unit DECIMAL,
  unit TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- App settings (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Seed data
-- ============================================================

-- Default app settings
INSERT INTO app_settings (key, value) VALUES
  ('default_zip_code', '80516'),
  ('store_chain', 'King Soopers'),
  ('todoist_project_name', 'groceries'),
  ('kroger_location_id', ''),
  ('order_modality', 'DELIVERY')
ON CONFLICT (key) DO NOTHING;

-- Seed abbreviation dictionary
INSERT INTO abbreviations (short_form, expansion, is_custom) VALUES
  ('tp', 'toilet paper', false),
  ('oj', 'orange juice', false),
  ('evoo', 'extra virgin olive oil', false),
  ('chx', 'chicken', false),
  ('pb', 'peanut butter', false),
  ('pb&j', 'peanut butter and jelly', false),
  ('mac', 'macaroni and cheese', false),
  ('broc', 'broccoli', false),
  ('tom', 'tomatoes', false),
  ('toms', 'tomatoes', false),
  ('parm', 'parmesan cheese', false),
  ('mozz', 'mozzarella cheese', false),
  ('ched', 'cheddar cheese', false),
  ('gr beef', 'ground beef', false),
  ('chx breast', 'chicken breast', false),
  ('chx thigh', 'chicken thighs', false),
  ('bb', 'blueberries', false),
  ('sb', 'strawberries', false),
  ('pt', 'paper towels', false),
  ('cc', 'cream cheese', false),
  ('gf', 'gluten free', false),
  ('org', 'organic', false)
ON CONFLICT (short_form) DO NOTHING;

-- Seed common product preferences (smart defaults)
INSERT INTO product_preferences (generic_name, display_name, preferred_brand, search_override) VALUES
  ('apples', 'Honeycrisp Apples', 'Honeycrisp', 'honeycrisp apples'),
  ('milk', '2% Reduced Fat Milk, Gallon', NULL, '2% milk gallon'),
  ('eggs', 'Large Eggs, Dozen', NULL, 'large eggs dozen'),
  ('bread', 'Whole Wheat Bread', NULL, 'whole wheat bread loaf'),
  ('chicken', 'Boneless Skinless Chicken Breast', NULL, 'boneless skinless chicken breast'),
  ('butter', 'Unsalted Butter, 1 lb', NULL, 'unsalted butter 1 lb'),
  ('cheese', 'Shredded Cheddar Cheese, 8oz', NULL, 'shredded cheddar cheese 8oz'),
  ('rice', 'Long Grain White Rice', NULL, 'long grain white rice'),
  ('pasta', 'Spaghetti Pasta, 1 lb', NULL, 'spaghetti pasta 1 lb'),
  ('bananas', 'Bananas', NULL, 'bananas per lb')
ON CONFLICT (generic_name) DO NOTHING;
