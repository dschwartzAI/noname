-- Migration 0003: Add tool_id and performance indexes for conversation history
--
-- Purpose: Add tool/agent selection and optimize conversation list queries
--
-- Changes:
-- 1. Add tool_id to conversations (nullable for default chat)
-- 2. Add indexes for fast conversation list loading
-- 3. Add index for message retrieval within conversations

--> statement-breakpoint

-- Add tool_id column to conversation table (nullable, for future agent/tool selection)
ALTER TABLE "conversation" ADD COLUMN "tool_id" text;

--> statement-breakpoint

-- Create indexes for performance

-- Index for loading user's conversations (most recent first)
CREATE INDEX "conversation_user_org_updated_idx" ON "conversation" ("user_id", "organization_id", "updated_at" DESC);

--> statement-breakpoint

-- Index for organization-wide conversation queries
CREATE INDEX "conversation_org_updated_idx" ON "conversation" ("organization_id", "updated_at" DESC);

--> statement-breakpoint

-- Index for loading messages within a conversation (chronological order)
CREATE INDEX "message_conversation_created_idx" ON "message" ("conversation_id", "created_at" ASC);

--> statement-breakpoint

-- Index for organization-wide message queries (for analytics/search)
CREATE INDEX "message_org_created_idx" ON "message" ("organization_id", "created_at" DESC);
