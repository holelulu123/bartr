-- Full-text search index on listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX idx_listings_fts ON listings USING GIN (search_vector);

-- Trigger to keep search_vector updated
CREATE OR REPLACE FUNCTION listings_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listings_search
  BEFORE INSERT OR UPDATE OF title, description ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_search_trigger();

-- Seed default categories
INSERT INTO categories (name, slug, parent_id) VALUES
  ('Electronics', 'electronics', NULL),
  ('Computers', 'computers', NULL),
  ('Clothing', 'clothing', NULL),
  ('Home & Garden', 'home-garden', NULL),
  ('Services', 'services', NULL),
  ('Crypto', 'crypto', NULL),
  ('Other', 'other', NULL)
ON CONFLICT (slug) DO NOTHING;
