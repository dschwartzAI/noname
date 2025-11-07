-- Update organization name to SoloOS
-- Run this in your Neon database SQL editor

-- First, let's see what organizations exist
SELECT id, name, slug, logo FROM organization;

-- Update the organization name for dschwartz06@gmail.com's organization
-- (Update this query with the actual organization ID from the SELECT above)
UPDATE organization 
SET name = 'SoloOS'
WHERE id IN (
  SELECT m.organization_id 
  FROM member m
  INNER JOIN "user" u ON m.user_id = u.id
  WHERE u.email = 'dschwartz06@gmail.com'
  AND m.role = 'owner'
);

-- Verify the update
SELECT o.id, o.name, o.slug, u.email, m.role
FROM organization o
INNER JOIN member m ON o.id = m.organization_id
INNER JOIN "user" u ON m.user_id = u.id
WHERE u.email = 'dschwartz06@gmail.com';

