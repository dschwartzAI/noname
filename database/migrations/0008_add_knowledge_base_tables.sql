-- Add Knowledge Base Tables for RAG System
-- Creates knowledge_bases, knowledge_base_documents, and knowledge_base_chunks tables

-- Create knowledge_bases table
CREATE TABLE IF NOT EXISTS "knowledge_bases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "created_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "vector_store_id" TEXT,
  "document_count" INTEGER DEFAULT 0 NOT NULL,
  "total_chunks" INTEGER DEFAULT 0 NOT NULL,
  "total_tokens" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create knowledge_base_documents table
CREATE TABLE IF NOT EXISTS "knowledge_base_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "knowledge_base_id" UUID NOT NULL REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "r2_key" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending' NOT NULL,
  "chunk_count" INTEGER DEFAULT 0 NOT NULL,
  "token_count" INTEGER DEFAULT 0 NOT NULL,
  "error_message" TEXT,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "processed_at" TIMESTAMP
);

-- Create knowledge_base_chunks table
CREATE TABLE IF NOT EXISTS "knowledge_base_chunks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL REFERENCES "knowledge_base_documents"("id") ON DELETE CASCADE,
  "knowledge_base_id" UUID NOT NULL REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "token_count" INTEGER DEFAULT 0 NOT NULL,
  "vector_id" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "kb_org_idx" ON "knowledge_bases"("organization_id");
CREATE INDEX IF NOT EXISTS "kb_creator_idx" ON "knowledge_bases"("created_by");
CREATE INDEX IF NOT EXISTS "kb_vector_store_idx" ON "knowledge_bases"("vector_store_id");

CREATE INDEX IF NOT EXISTS "kb_docs_kb_idx" ON "knowledge_base_documents"("knowledge_base_id");
CREATE INDEX IF NOT EXISTS "kb_docs_org_idx" ON "knowledge_base_documents"("organization_id");
CREATE INDEX IF NOT EXISTS "kb_docs_status_idx" ON "knowledge_base_documents"("status");
CREATE INDEX IF NOT EXISTS "kb_docs_org_kb_idx" ON "knowledge_base_documents"("organization_id", "knowledge_base_id");

CREATE INDEX IF NOT EXISTS "kb_chunks_doc_idx" ON "knowledge_base_chunks"("document_id");
CREATE INDEX IF NOT EXISTS "kb_chunks_kb_idx" ON "knowledge_base_chunks"("knowledge_base_id");
CREATE INDEX IF NOT EXISTS "kb_chunks_org_idx" ON "knowledge_base_chunks"("organization_id");
CREATE INDEX IF NOT EXISTS "kb_chunks_vector_idx" ON "knowledge_base_chunks"("vector_id");
CREATE INDEX IF NOT EXISTS "kb_chunks_doc_chunk_idx" ON "knowledge_base_chunks"("document_id", "chunk_index");
