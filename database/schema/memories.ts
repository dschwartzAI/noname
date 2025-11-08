/**
 * Memories Schema - User Business Context Storage
 *
 * Stores user business context that gets injected into AI chat conversations
 * Categories: Business Info, Target Audience, Offers, Challenges, Goals
 */

import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const memories = pgTable('memories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Multi-tenancy (using organization instead of tenant for compatibility)
  userId: text('user_id').notNull(),
  organizationId: text('organization_id').notNull(),

  // Memory content
  key: text('key').notNull(), // e.g., "Business Type", "Target Audience", etc.
  value: text('value').notNull(), // e.g., "Health coaching for entrepreneurs"

  // Organization
  category: text('category')
    .$type<'business_info' | 'target_audience' | 'offers' | 'current_projects' | 'challenges' | 'goals' | 'personal_info'>()
    .notNull(), // For grouping related memories

  source: text('source')
    .$type<'manual' | 'auto' | 'agent'>()
    .default('manual')
    .notNull(), // How was this memory created

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // Index for fast user + org queries
  userOrgIdx: index('memories_user_org_idx').on(table.userId, table.organizationId),
  // Index for category filtering
  categoryIdx: index('memories_category_idx').on(table.category),
  // Composite index for common query pattern
  userOrgCategoryIdx: index('memories_user_org_category_idx')
    .on(table.userId, table.organizationId, table.category),
}));

// Export types
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
