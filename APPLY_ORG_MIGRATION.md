# 🚀 Apply Organization Migration

Since the Node script is having authentication issues, let's use Neon's SQL Editor directly.

## Steps:

1. **Go to Neon SQL Editor:**
   - Visit: https://console.neon.tech/app/projects
   - Select your project: `ep-holy-dawn-afutxqyk`
   - Click on "SQL Editor" in the left sidebar

2. **Copy and paste this SQL:**

```sql
-- Multi-Tenant White-Label Migration
-- Adds organization support for God > Owner > Users hierarchy

-- Step 1: Add isGod field to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_god" BOOLEAN DEFAULT FALSE NOT NULL;

-- Step 2: Create organization table
CREATE TABLE IF NOT EXISTS "organization" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logo" TEXT,
  "metadata" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 3: Create member table (User-Organization relationship)
CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("user_id", "organization_id")
);

-- Step 4: Add optional active_organization_id to session for better UX
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "active_organization_id" TEXT;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member"("user_id");
CREATE INDEX IF NOT EXISTS "member_organization_id_idx" ON "member"("organization_id");
CREATE INDEX IF NOT EXISTS "member_role_idx" ON "member"("role");
CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "user_is_god_idx" ON "user"("is_god");
```

3. **Click "Run" to execute**

4. **Set yourself as God:**

```sql
-- Replace with your email
UPDATE "user" 
SET "is_god" = TRUE 
WHERE email = 'your-email@example.com';
```

5. **Verify it worked:**

```sql
-- Check your user
SELECT id, email, name, is_god FROM "user" WHERE email = 'your-email@example.com';

-- Check tables were created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('organization', 'member');
```

---

## ✅ Done!

After running the migration, you're ready to:
1. Deploy the updated code to Cloudflare
2. Create your first organization from the app
3. Start building the God dashboard

See `MULTI_TENANT_SETUP.md` for full usage guide.

