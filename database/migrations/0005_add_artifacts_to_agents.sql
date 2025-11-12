-- Add artifacts configuration columns to agents table
ALTER TABLE "agents" ADD COLUMN "artifacts_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "agents" ADD COLUMN "artifact_instructions" text;
