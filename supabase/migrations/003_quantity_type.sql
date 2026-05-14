-- Add quantity classification columns to list_items
-- quantity_type: 'count' (discrete items) or 'measurement' (recipe amounts)
-- min_required_amount: for measurements, the minimum needed in base units
-- min_required_unit: base unit ('oz' or 'fl oz')

ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS quantity_type TEXT,
  ADD COLUMN IF NOT EXISTS min_required_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS min_required_unit TEXT;

-- Add a CHECK constraint to validate quantity_type values
ALTER TABLE list_items
  ADD CONSTRAINT chk_quantity_type
  CHECK (quantity_type IS NULL OR quantity_type IN ('count', 'measurement'));
