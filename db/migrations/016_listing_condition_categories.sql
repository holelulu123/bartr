-- Add condition column to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add new marketplace categories
INSERT INTO categories (name, slug, parent_id) VALUES
  ('Vehicles', 'vehicles', NULL),
  ('Phones & Tablets', 'phones-tablets', NULL),
  ('Furniture', 'furniture', NULL),
  ('Sports & Outdoors', 'sports-outdoors', NULL),
  ('Baby & Kids', 'baby-kids', NULL),
  ('Books & Media', 'books-media', NULL),
  ('Tools', 'tools', NULL),
  ('Collectibles', 'collectibles', NULL),
  ('Musical Instruments', 'musical-instruments', NULL),
  ('Pets', 'pets', NULL),
  ('Jewelry & Watches', 'jewelry-watches', NULL),
  ('Gaming', 'gaming', NULL),
  ('Free Stuff', 'free-stuff', NULL)
ON CONFLICT (slug) DO NOTHING;
