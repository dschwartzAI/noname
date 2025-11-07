/**
 * Conversations Schema - AI Chat Conversations
 *
 * Stores chat conversations with AI models and agents
 * Supports multi-tenant isolation and conversation configuration
 */

import { pgTable, text, uuid, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './auth';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Multi-tenancy
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),

  // Owner
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  // Content
  title: text('title'),

  // AI Configuration
  provider: text('provider')
    .$type<'openai' | 'anthropic' | 'xai' | 'bedrock'>()
    .default('openai')
    .notNull(),
  model: text('model').notNull(), // e.g., 'gpt-4', 'claude-3-sonnet', etc.
  agentId: text('agent_id'), // References agents.id (nullable for non-agent chats)

  // Model parameters
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
  }>().default({
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  }),

  // System prompt (optional override)
  systemPrompt: text('system_prompt'),

  // Status
  archived: boolean('archived').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  lastMessageAt: timestamp('last_message_at'),
}, (table) => ({
  // Indexes for performance
  tenantIdx: index('conversations_tenant_idx').on(table.tenantId),
  userIdx: index('conversations_user_idx').on(table.userId),
  agentIdx: index('conversations_agent_idx').on(table.agentId),
  lastMessageIdx: index('conversations_last_message_idx').on(table.lastMessageAt),
  // Compound index for user's conversations
  userTenantIdx: index('conversations_user_tenant_idx').on(table.userId, table.tenantId),
}));

// Relations for Drizzle queries
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conversations.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  // Note: agents relation will be added when agents schema is imported
  messages: many('messages' as any), // Forward reference to messages
}));

// Export types for TypeScript
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
