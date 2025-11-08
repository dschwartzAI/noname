/**
 * Message Board Schema
 * 
 * For the Syndicate LMS system - Message Board (community discussions)
 */

import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './auth';

// Discussion categories/channels
export const boardCategories = pgTable('board_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'), // Emoji or icon name
  color: text('color'),
  
  // Order
  order: integer('order').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Discussion threads
export const boardThreads = pgTable('board_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: uuid('category_id')
    .references(() => boardCategories.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  content: text('content').notNull(),
  
  // Status
  pinned: boolean('pinned').default(false),
  locked: boolean('locked').default(false),
  solved: boolean('solved').default(false),
  
  // Stats
  viewCount: integer('view_count').default(0),
  replyCount: integer('reply_count').default(0),
  likeCount: integer('like_count').default(0),
  
  // Tags
  tags: jsonb('tags').$type<string[]>().default([]),
  
  // Last activity
  lastReplyAt: timestamp('last_reply_at'),
  lastReplyBy: uuid('last_reply_by'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Thread replies
export const boardReplies = pgTable('board_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  threadId: uuid('thread_id')
    .references(() => boardThreads.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  content: text('content').notNull(),
  
  // Nested replies (optional - for threaded discussions)
  parentReplyId: uuid('parent_reply_id'),
  
  // Status
  markedAsSolution: boolean('marked_as_solution').default(false),
  edited: boolean('edited').default(false),
  editedAt: timestamp('edited_at'),
  
  // Stats
  likeCount: integer('like_count').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Likes/reactions
export const boardLikes = pgTable('board_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Can like either thread or reply
  threadId: uuid('thread_id').references(() => boardThreads.id, { onDelete: 'cascade' }),
  replyId: uuid('reply_id').references(() => boardReplies.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Thread subscriptions (for notifications)
export const boardSubscriptions = pgTable('board_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  threadId: uuid('thread_id')
    .references(() => boardThreads.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes for performance
export const threadsByCategory = index('board_threads_category_id_idx').on(boardThreads.categoryId);
export const threadsByTenant = index('board_threads_tenant_id_idx').on(boardThreads.tenantId);
export const repliesByThread = index('board_replies_thread_id_idx').on(boardReplies.threadId);

// Full-text search on threads
export const threadsSearchIndex = index('board_threads_search_idx')
  .using('gin', sql`to_tsvector('english', ${boardThreads.title} || ' ' || ${boardThreads.content})`);

// Full-text search on replies
export const repliesSearchIndex = index('board_replies_search_idx')
  .using('gin', sql`to_tsvector('english', ${boardReplies.content})`);

// Types
export type InsertBoardCategory = typeof boardCategories.$inferInsert;
export type SelectBoardCategory = typeof boardCategories.$inferSelect;
export type InsertBoardThread = typeof boardThreads.$inferInsert;
export type SelectBoardThread = typeof boardThreads.$inferSelect;
export type InsertBoardReply = typeof boardReplies.$inferInsert;
export type SelectBoardReply = typeof boardReplies.$inferSelect;
export type InsertBoardLike = typeof boardLikes.$inferInsert;
export type SelectBoardLike = typeof boardLikes.$inferSelect;
export type InsertBoardSubscription = typeof boardSubscriptions.$inferInsert;
export type SelectBoardSubscription = typeof boardSubscriptions.$inferSelect;




