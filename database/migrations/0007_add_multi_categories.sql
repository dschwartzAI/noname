-- Migration: Add multi-select categories support
-- Changes 'category' (text) to 'categories' (jsonb array)

-- Add new categories column as jsonb array
ALTER TABLE courses ADD COLUMN categories jsonb DEFAULT '[]'::jsonb;

-- Migrate existing category data to categories array
UPDATE courses 
SET categories = jsonb_build_array(category)
WHERE category IS NOT NULL AND category != '';

-- Drop old category column
ALTER TABLE courses DROP COLUMN category;

