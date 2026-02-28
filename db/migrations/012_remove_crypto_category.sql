-- Remove the Crypto category from the marketplace (exchange handles crypto)
-- First nullify any listings that reference this category
UPDATE listings SET category_id = NULL
  WHERE category_id = (SELECT id FROM categories WHERE slug = 'crypto');

DELETE FROM categories WHERE slug = 'crypto';
