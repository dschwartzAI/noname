# Clean Up Extra Organizations

You currently have 3 organizations in your database. Let's keep only **SoloOS** and delete the other two.

## Step 1: Verify Current Organizations

Run this query in your Neon SQL Editor:

```sql
SELECT id, name, slug, created_at 
FROM organization 
ORDER BY created_at;
```

You should see:
1. Dan's Test Workspace
2. Test Organization  
3. SoloOS (the one we want to keep)

## Step 2: Delete the Extra Organizations

Run this query to delete the first two:

```sql
-- Delete Dan's Test Workspace and Test Organization
DELETE FROM organization 
WHERE name IN ('Dan''s Test Workspace', 'Test Organization');
```

**Note:** The member records will be automatically deleted due to the CASCADE delete constraint in the database schema.

## Step 3: Verify Only SoloOS Remains

```sql
SELECT o.id, o.name, o.slug, o.created_at,
       u.email as owner_email, m.role
FROM organization o
LEFT JOIN member m ON o.id = m.organization_id
LEFT JOIN "user" u ON m.user_id = u.id
WHERE u.email = 'dschwartz06@gmail.com';
```

You should now see only one row with **SoloOS**.

## Step 4: Refresh Your Browser

After running these queries:
1. Go to your application
2. Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux)
3. The sidebar should now show **SoloOS** instead of "Dan's Test Workspace"

## Alternative: Delete All and Keep Newest

If you want to be extra safe and just keep the newest organization:

```sql
DELETE FROM organization 
WHERE created_at < (
  SELECT MAX(created_at) FROM organization
);
```

This will automatically keep SoloOS since it was created most recently (11/7/2025).

## Troubleshooting

### If you accidentally deleted SoloOS

Don't worry! You can recreate it:

```sql
-- Get your user ID first
SELECT id, email FROM "user" WHERE email = 'dschwartz06@gmail.com';

-- Create SoloOS organization (replace YOUR_USER_ID with actual ID from above)
INSERT INTO organization (id, name, slug, logo, metadata, created_at)
VALUES (
  gen_random_uuid()::text,
  'SoloOS',
  'soloos',
  NULL,
  NULL,
  NOW()
);

-- Make yourself the owner (replace YOUR_USER_ID and ORG_ID)
INSERT INTO member (id, organization_id, user_id, role, created_at)
SELECT 
  gen_random_uuid()::text,
  o.id,
  'YOUR_USER_ID',
  'owner',
  NOW()
FROM organization o
WHERE o.slug = 'soloos';
```

### If the sidebar still shows the old name

1. Clear browser cache
2. Check God Dashboard to verify only SoloOS exists
3. Log out and log back in
4. Check the browser console for any API errors

## Result

After completing these steps:
- ✅ Only SoloOS organization will exist
- ✅ Sidebar will show "SoloOS" instead of "Dan's Test Workspace"
- ✅ You'll be the owner of SoloOS
- ✅ God Dashboard will show only one organization

