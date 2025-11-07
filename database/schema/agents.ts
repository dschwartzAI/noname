/**
 * Agents Schema - Custom AI Agents
 *
 * Stores custom AI agents with tools, instructions, and configuration
 * Agents can be used across conversations for specialized tasks
 */

import { pgTable, text, uuid, timestamp, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './auth';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // Custom ID format: 'agent_abc123'

  // Multi-tenancy
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),

  // Creator
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'set null' }),

  // Basic info
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),

  // AI Configuration
  provider: text('provider')
    .$type<'openai' | 'anthropic' | 'xai' | 'bedrock'>()
    .default('openai')
    .notNull(),
  model: text('model').notNull(), // e.g., 'gpt-4', 'claude-3-sonnet'

  // Tools configuration
  tools: jsonb('tools').$type<string[]>().default([]),
  toolResources: jsonb('tool_resources').$type<{
    fileSearch?: {
      fileIds: string[];
      vectorStoreIds?: string[];
    };
    codeInterpreter?: {
      fileIds: string[];
    };
    webSearch?: {
      enabled: boolean;
    };
    composio?: {
      actions: string[]; // e.g., ['GITHUB_GET_REPOS', 'GMAIL_SEND_EMAIL']
    };
  }>(),

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

  // Metadata
  icon: text('icon'), // Emoji or icon identifier
  avatar: jsonb('avatar').$type<{
    source: 'emoji' | 'url' | 'upload';
    value: string;
  }>(),

  // Access control
  tier: text('tier')
    .$type<'free' | 'pro' | 'enterprise'>()
    .default('free')
    .notNull(),
  published: boolean('published').default(false).notNull(),
  isSystem: boolean('is_system').default(false).notNull(), // Pre-built system agents

  // Versioning
  version: integer('version').default(1).notNull(),

  // Usage stats (optional)
  usageCount: integer('usage_count').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // Indexes for performance
  tenantIdx: index('agents_tenant_idx').on(table.tenantId),
  creatorIdx: index('agents_creator_idx').on(table.createdBy),
  publishedIdx: index('agents_published_idx').on(table.published),
  systemIdx: index('agents_system_idx').on(table.isSystem),
  tierIdx: index('agents_tier_idx').on(table.tier),
  // Compound index for tenant's published agents
  tenantPublishedIdx: index('agents_tenant_published_idx')
    .on(table.tenantId, table.published),
}));

// Relations for Drizzle queries
export const agentsRelations = relations(agents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [agents.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [agents.createdBy],
    references: [users.id],
  }),
  // Conversations using this agent (forward reference)
  conversations: many('conversations' as any),
}));

// Export types for TypeScript
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
