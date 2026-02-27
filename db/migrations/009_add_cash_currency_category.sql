-- Add Cash & Currency category
INSERT INTO categories (name, slug, parent_id) VALUES
  ('Cash & Currency', 'cash-currency', NULL)
ON CONFLICT (slug) DO NOTHING;
