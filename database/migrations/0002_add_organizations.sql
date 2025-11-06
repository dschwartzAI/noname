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
  "metadata" TEXT, -- JSON string for branding, tier, custom domain, etc.
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 3: Create member table (User-Organization relationship)
CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL, -- 'owner', 'admin', 'member'
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("user_id", "organization_id") -- A user can only have one membership per org
);

-- Step 4: Add optional active_organization_id to session for better UX
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "active_organization_id" TEXT;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member"("user_id");
CREATE INDEX IF NOT EXISTS "member_organization_id_idx" ON "member"("organization_id");
CREATE INDEX IF NOT EXISTS "member_role_idx" ON "member"("role");
CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "user_is_god_idx" ON "user"("is_god");

-- Step 6: Add comment for documentation
COMMENT ON COLUMN "user"."is_god" IS 'Super admin flag - can access all organizations and system settings';
COMMENT ON TABLE "organization" IS 'White-label organizations - each represents a separate tenant/instance';
COMMENT ON TABLE "member" IS 'User-Organization membership with role-based access control';
COMMENT ON COLUMN "member"."role" IS 'User role: owner (full control), admin (manage users), member (regular user)';
COMMENT ON COLUMN "organization"."metadata" IS 'JSON containing: tier (free/pro/enterprise), branding (colors, logo), customDomain, etc.';

