-- Add Courses Tables for LMS System
-- Creates tenants, courses, modules, lessons, course_enrollments, and lesson_progress tables

-- Create tenants table (if not already present)
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "subdomain" TEXT NOT NULL UNIQUE,
  "config" JSONB DEFAULT '{"branding":{"logo":"/logo.png","primaryColor":"#000000","companyName":"Solo OS"},"features":{"agents":true,"rag":true,"memory":true,"composio":false},"limits":{"maxUsers":10,"maxAgents":5,"maxStorage":1073741824,"maxApiCalls":10000}}'::jsonb,
  "tier" TEXT NOT NULL DEFAULT 'free',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "tenants_subdomain_idx" ON "tenants"("subdomain");
CREATE INDEX IF NOT EXISTS "tenants_active_idx" ON "tenants"("active");

-- Create courses table
CREATE TABLE IF NOT EXISTS "courses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnail" TEXT,
  "instructor" TEXT NOT NULL,
  "instructor_bio" TEXT,
  "instructor_avatar" TEXT,
  "tier" TEXT NOT NULL DEFAULT 'free',
  "published" BOOLEAN DEFAULT false,
  "enrollment_count" INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create modules table
CREATE TABLE IF NOT EXISTS "modules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "course_id" UUID NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER DEFAULT 0,
  "published" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS "lessons" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" UUID NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "video_url" TEXT,
  "video_provider" TEXT,
  "duration" INTEGER,
  "thumbnail" TEXT,
  "transcript" TEXT,
  "transcript_url" TEXT,
  "recording_metadata" JSONB,
  "resources" JSONB DEFAULT '[]'::jsonb,
  "published" BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create course_enrollments table
CREATE TABLE IF NOT EXISTS "course_enrollments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "course_id" UUID NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "completed_lessons" JSONB DEFAULT '[]'::jsonb,
  "last_accessed_lesson_id" UUID,
  "progress_percentage" INTEGER DEFAULT 0,
  "enrolled_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_accessed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP
);

-- Create lesson_progress table
CREATE TABLE IF NOT EXISTS "lesson_progress" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "lesson_id" UUID NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "completed" BOOLEAN DEFAULT false,
  "watch_time_seconds" INTEGER DEFAULT 0,
  "last_watch_position" INTEGER DEFAULT 0,
  "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "courses_tenant_id_idx" ON "courses"("tenant_id");
CREATE INDEX IF NOT EXISTS "courses_published_idx" ON "courses"("published");
CREATE INDEX IF NOT EXISTS "modules_course_id_idx" ON "modules"("course_id");
CREATE INDEX IF NOT EXISTS "modules_tenant_id_idx" ON "modules"("tenant_id");
CREATE INDEX IF NOT EXISTS "lessons_module_id_idx" ON "lessons"("module_id");
CREATE INDEX IF NOT EXISTS "lessons_tenant_id_idx" ON "lessons"("tenant_id");
CREATE INDEX IF NOT EXISTS "course_enrollments_user_id_idx" ON "course_enrollments"("user_id");
CREATE INDEX IF NOT EXISTS "course_enrollments_course_id_idx" ON "course_enrollments"("course_id");
CREATE INDEX IF NOT EXISTS "course_enrollments_tenant_id_idx" ON "course_enrollments"("tenant_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_tenant_id_idx" ON "lesson_progress"("tenant_id");

-- Removed updated_at trigger function and triggers to simplify migration

