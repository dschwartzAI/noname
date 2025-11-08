/**
 * Messages Schema - Chat Messages with Branching Support
 *
 * Stores individual messages in conversations
 * Supports message branching for exploring alternative conversation paths
 */

import { pgTable, text, uuid, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organization } from '../better-auth-schema';
import { conversations } from './conversations';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Multi-tenancy
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),

  // Parent conversation
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),

  // Content
  content: text('content').notNull(),
  role: text('role')
    .$type<'user' | 'assistant' | 'system' | 'tool'>()
    .notNull(),

  // Message tree (for branching conversations)
  parentMessageId: uuid('parent_message_id'), // Self-reference for message branching

  // AI metadata
  model: text('model'),
  provider: text('provider'),
  finishReason: text('finish_reason'), // 'stop' | 'length' | 'tool_calls' | 'content_filter'

  // Token usage tracking
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),

  // Tool calling (for function/tool messages)
  toolCallId: text('tool_call_id'),
  toolName: text('tool_name'),

  // Status flags
  error: boolean('error').default(false).notNull(),
  errorMessage: text('error_message'),
  cancelled: boolean('cancelled').default(false).notNull(),
  unfinished: boolean('unfinished').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // Indexes for performance
  orgIdx: index('messages_org_idx').on(table.organizationId),
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  parentIdx: index('messages_parent_idx').on(table.parentMessageId),
  roleIdx: index('messages_role_idx').on(table.role),
  // Compound index for conversation messages in order
  conversationCreatedIdx: index('messages_conversation_created_idx')
    .on(table.conversationId, table.createdAt),
  // Full-text search on message content
  searchIdx: index('messages_search_idx')
    .using('gin', sql`to_tsvector('english', ${table.content})`),
}));

// Self-referencing relation for message branching
export const messagesRelations = relations(messages, ({ one, many }) => ({
  organization: one(organization, {
    fields: [messages.organizationId],
    references: [organization.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id],
    relationName: 'messageTree',
  }),
  childMessages: many(messages, {
    relationName: 'messageTree',
  }),
}));

// Export types for TypeScript
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
