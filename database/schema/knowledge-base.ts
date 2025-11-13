/**
 * Knowledge Base Schema - RAG Document Storage
 *
 * Stores document collections with vector embeddings for semantic search
 * Owner-only management, all users can use in agents
 */

import { pgTable, text, uuid, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organization, user } from '../better-auth-schema';

/**
 * Knowledge Bases - Collections of documents for RAG
 * Owner creates/manages these in admin settings
 */
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Multi-tenancy (organization isolation)
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),

  // Creator (owner only)
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'set null' }),

  // Basic info
  name: text('name').notNull(),
  description: text('description'),

  // Cloudflare Vectorize index ID
  vectorStoreId: text('vector_store_id'), // e.g., 'kb-{uuid}'

  // Stats
  documentCount: integer('document_count').default(0).notNull(),
  totalChunks: integer('total_chunks').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // Indexes for multi-tenant queries
  orgIdx: index('kb_org_idx').on(table.organizationId),
  creatorIdx: index('kb_creator_idx').on(table.createdBy),
  vectorStoreIdx: index('kb_vector_store_idx').on(table.vectorStoreId),
}));

/**
 * Knowledge Base Documents - Individual uploaded files
 */
export const knowledgeBaseDocuments = pgTable('knowledge_base_documents', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  knowledgeBaseId: uuid('knowledge_base_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' })
    .notNull(),

  // Multi-tenancy (duplicated for direct queries)
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),

  // Document info
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(), // bytes

  // R2 storage path
  r2Key: text('r2_key').notNull(), // e.g., 'knowledge-base/{orgId}/{kbId}/{timestamp}-{filename}'

  // Processing status
  status: text('status')
    .$type<'pending' | 'processing' | 'completed' | 'failed'>()
    .default('pending')
    .notNull(),

  // Processing metadata
  chunkCount: integer('chunk_count').default(0).notNull(),
  tokenCount: integer('token_count').default(0).notNull(),
  errorMessage: text('error_message'),

  // Timestamps
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  // Indexes
  kbIdx: index('kb_docs_kb_idx').on(table.knowledgeBaseId),
  orgIdx: index('kb_docs_org_idx').on(table.organizationId),
  statusIdx: index('kb_docs_status_idx').on(table.status),
  // Compound index for organization's documents
  orgKbIdx: index('kb_docs_org_kb_idx')
    .on(table.organizationId, table.knowledgeBaseId),
}));

/**
 * Document Chunks - Text chunks stored in Cloudflare Vectorize
 *
 * NOTE: The actual vector embeddings are stored in Vectorize, not in this table.
 * This table serves as a reference/audit log for chunks that have been embedded.
 */
export const knowledgeBaseChunks = pgTable('knowledge_base_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  documentId: uuid('document_id')
    .references(() => knowledgeBaseDocuments.id, { onDelete: 'cascade' })
    .notNull(),

  knowledgeBaseId: uuid('knowledge_base_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' })
    .notNull(),

  // Multi-tenancy
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),

  // Chunk content
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(), // Position in document

  // Metadata
  tokenCount: integer('token_count').default(0).notNull(),

  // Vectorize ID (for reference)
  vectorId: text('vector_id').notNull(), // UUID used in Vectorize

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes
  docIdx: index('kb_chunks_doc_idx').on(table.documentId),
  kbIdx: index('kb_chunks_kb_idx').on(table.knowledgeBaseId),
  orgIdx: index('kb_chunks_org_idx').on(table.organizationId),
  vectorIdx: index('kb_chunks_vector_idx').on(table.vectorId),
  // Compound index for document chunks in order
  docChunkIdx: index('kb_chunks_doc_chunk_idx')
    .on(table.documentId, table.chunkIndex),
}));

// Relations for Drizzle queries
export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  organization: one(organization, {
    fields: [knowledgeBases.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [knowledgeBases.createdBy],
    references: [user.id],
  }),
  documents: many(knowledgeBaseDocuments),
  chunks: many(knowledgeBaseChunks),
}));

export const knowledgeBaseDocumentsRelations = relations(knowledgeBaseDocuments, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeBaseDocuments.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  organization: one(organization, {
    fields: [knowledgeBaseDocuments.organizationId],
    references: [organization.id],
  }),
  chunks: many(knowledgeBaseChunks),
}));

export const knowledgeBaseChunksRelations = relations(knowledgeBaseChunks, ({ one }) => ({
  document: one(knowledgeBaseDocuments, {
    fields: [knowledgeBaseChunks.documentId],
    references: [knowledgeBaseDocuments.id],
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeBaseChunks.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  organization: one(organization, {
    fields: [knowledgeBaseChunks.organizationId],
    references: [organization.id],
  }),
}));

// Export types for TypeScript
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type NewKnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferInsert;

export type KnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferSelect;
export type NewKnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferInsert;
