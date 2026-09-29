-- ==============================================================================
-- Migration: Add Market Test Support & Product Likes Table for Barforoosh Farhoodi
-- ==============================================================================

-- 1. Add `is_market_test` column to products table if not present
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_market_test BOOLEAN DEFAULT FALSE;

-- 2. Create product_likes table for store market testing feedback
CREATE TABLE IF NOT EXISTS product_likes (
  id TEXT PRIMARY KEY DEFAULT ('like-' || floor(random() * 1000000)::text),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supermarket_id TEXT NOT NULL,
  supermarket_name TEXT,
  supermarket_owner TEXT,
  supermarket_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_product_supermarket_like UNIQUE (product_id, supermarket_id)
);

-- 3. Create Index for fast product-specific queries
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_supermarket_id ON product_likes(supermarket_id);
