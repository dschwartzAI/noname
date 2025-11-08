-- Migration: Standardize on Better Auth organization schema
-- Rename tenantId → organizationId, change uuid → text, update foreign keys

-- ============================================================
-- 1. UPDATE CONVERSATIONS TABLE
-- ============================================================

-- Drop old indexes first
DROP INDEX IF EXISTS "conversations_tenant_idx";
DROP INDEX IF EXISTS "conversations_user_tenant_idx";

-- Rename tenant_id column to organization_id and change type
-- Note: This requires dropping and recreating foreign key constraints
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_tenant_id_tenants_id_fk";
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_user_id_users_id_fk";

-- Rename and change type (this assumes data migration happened or table is empty)
ALTER TABLE "conversations"
  DROP COLUMN IF EXISTS "tenant_id",
  ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE;

-- Update user_id to reference Better Auth user table (change from uuid to text)
ALTER TABLE "conversations"
  DROP COLUMN IF EXISTS "user_id",
  ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE;

-- Create new indexes
CREATE INDEX IF NOT EXISTS "conversations_org_idx" ON "conversations" ("organization_id");
CREATE INDEX IF NOT EXISTS "conversations_user_org_idx" ON "conversations" ("user_id", "organization_id");

-- ============================================================
-- 2. UPDATE MESSAGES TABLE
-- ============================================================

-- Drop old indexes
DROP INDEX IF EXISTS "messages_tenant_idx";

-- Drop old constraints
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_tenant_id_tenants_id_fk";

-- Rename and change type
ALTER TABLE "messages"
  DROP COLUMN IF EXISTS "tenant_id",
  ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE;

-- Create new index
CREATE INDEX IF NOT EXISTS "messages_org_idx" ON "messages" ("organization_id");

-- ============================================================
-- 3. UPDATE AGENTS TABLE
-- ============================================================

-- Drop old indexes
DROP INDEX IF EXISTS "agents_tenant_idx";
DROP INDEX IF EXISTS "agents_tenant_published_idx";

-- Drop old constraints
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_tenant_id_tenants_id_fk";
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_created_by_users_id_fk";

-- Rename and change type
ALTER TABLE "agents"
  DROP COLUMN IF EXISTS "tenant_id",
  ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE;

-- Update created_by to reference Better Auth user (change from uuid to text)
ALTER TABLE "agents"
  DROP COLUMN IF EXISTS "created_by",
  ADD COLUMN IF NOT EXISTS "created_by" text REFERENCES "user"("id") ON DELETE SET NULL;

-- Create new indexes
CREATE INDEX IF NOT EXISTS "agents_org_idx" ON "agents" ("organization_id");
CREATE INDEX IF NOT EXISTS "agents_org_published_idx" ON "agents" ("organization_id", "published");

-- ============================================================
-- 4. DROP OLD TABLES (no longer needed)
-- ============================================================

-- These are replaced by Better Auth tables
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "verifications" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;

-- ============================================================
-- NOTES
-- ============================================================
-- This migration assumes:
-- 1. Tables are empty OR data has been migrated to Better Auth tables
-- 2. Better Auth tables (user, organization, etc.) already exist
-- 3. If data exists, run data migration script BEFORE this schema migration
