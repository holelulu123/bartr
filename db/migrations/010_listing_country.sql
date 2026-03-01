-- Add country_code to listings (ISO 3166-1 alpha-2)
DO $$ BEGIN
  ALTER TABLE listings ADD COLUMN country_code TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_country ON listings (country_code);

-- Remove the "Cash & Currency" category
DELETE FROM categories WHERE slug = 'cash-currency';
