/**
 * Knowledge Base Schema - Cloudflare AI Search Integration
 *
 * Stores knowledge base metadata for Cloudflare AI Search
 * Documents are uploaded to R2 and automatically indexed by AI Search
 * Owner-only management, all users can use in agents
 */

import { pgTable, text, uuid, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organization, user } from '../better-auth-schema';

/**
 * Knowledge Bases - Collections of documents for RAG via AI Search
 *
 * Cloudflare AI Search Architecture:
 * - Documents uploaded to R2 (r2PathPrefix folder)
 * - AI Search automatically extracts text, chunks, generates embeddings
 * - Embeddings stored in Vectorize index (aiSearchStoreId)
 * - Query via env.AI_SEARCH.search() with metadata filtering
 *
 * Multi-tenancy:
 * - Each KB has unique R2 folder: kb/{orgId}/{kbId}/
 * - Search queries filter by metadata.organizationId
 * - Prevents cross-tenant data leakage
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

  // Cloudflare AI Search configuration
  aiSearchStoreId: text('ai_search_store_id')
    .notNull()
    .default('soloo-rag-store'), // Vectorize index name (created via AI Search)

  // R2 storage path for this KB's documents
  // Format: 'kb/{orgId}/{kbId}/'
  // All documents for this KB are uploaded to this prefix
  r2PathPrefix: text('r2_path_prefix').notNull(),

  // Stats (synced from AI Search or R2 list operations)
  documentCount: integer('document_count').default(0).notNull(),
  lastSyncedAt: timestamp('last_synced_at'), // Last time stats were synced

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // Indexes for multi-tenant queries
  orgIdx: index('kb_org_idx').on(table.organizationId),
  creatorIdx: index('kb_creator_idx').on(table.createdBy),
}));

// Relations for Drizzle queries
export const knowledgeBasesRelations = relations(knowledgeBases, ({ one }) => ({
  organization: one(organization, {
    fields: [knowledgeBases.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [knowledgeBases.createdBy],
    references: [user.id],
  }),
}));

// Export types for TypeScript
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
