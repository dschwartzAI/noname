-- Delete extra organizations and keep only SoloOS
-- Run this in your Neon database SQL editor

-- First, let's see all organizations with their IDs
SELECT id, name, slug, created_at 
FROM organization 
ORDER BY created_at;

-- Delete "Dan's Test Workspace" and "Test Organization"
-- Keep only "SoloOS"

-- This will cascade delete all related members due to ON DELETE CASCADE
DELETE FROM organization 
WHERE name IN ('Dan''s Test Workspace', 'Test Organization');

-- Or if you prefer to delete by creation date (keeping the newest one):
-- DELETE FROM organization 
-- WHERE created_at < (
--   SELECT MAX(created_at) FROM organization
-- );

-- Verify only SoloOS remains
SELECT o.id, o.name, o.slug, o.created_at,
       u.email as owner_email, m.role
FROM organization o
LEFT JOIN member m ON o.id = m.organization_id
LEFT JOIN "user" u ON m.user_id = u.id
ORDER BY o.created_at;

-- Make sure your user is a member of SoloOS
-- If not, run this (replace 'YOUR_USER_ID' with actual user ID):
-- INSERT INTO member (id, organization_id, user_id, role, created_at)
-- SELECT 
--   gen_random_uuid()::text,
--   o.id,
--   u.id,
--   'owner',
--   NOW()
-- FROM organization o, "user" u
-- WHERE o.name = 'SoloOS' 
-- AND u.email = 'dschwartz06@gmail.com'
-- AND NOT EXISTS (
--   SELECT 1 FROM member m 
--   WHERE m.organization_id = o.id 
--   AND m.user_id = u.id
-- );

