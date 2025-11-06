/**
 * Auth Schema - Postgres Version with Multi-tenancy
 * 
 * Converted from SQLite to Postgres
 * Added tenant references for multi-tenancy
 */

import { pgTable, text, uuid, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Multi-tenancy
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User info
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  
  // Role & tier
  role: text('role').$type<'user' | 'admin' | 'owner'>().default('user').notNull(),
  tier: text('tier').$type<'free' | 'pro'>().default('free').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  
  // Better Auth compatibility
  isAnonymous: boolean('is_anonymous'),
}, (table) => ({
  tenantIdx: index('users_tenant_idx').on(table.tenantId),
  emailIdx: index('users_email_idx').on(table.email),
  // Email must be unique per tenant
  emailTenantIdx: index('users_email_tenant_idx').on(table.email, table.tenantId),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Session metadata
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timezone: text('timezone'),
  city: text('city'),
  country: text('country'),
  region: text('region'),
  regionCode: text('region_code'),
  colo: text('colo'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('sessions_token_idx').on(table.token),
  userIdx: index('sessions_user_idx').on(table.userId),
}));

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // OAuth tokens
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  
  // Password (for email/password auth)
  password: text('password'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('accounts_user_idx').on(table.userId),
  providerIdx: index('accounts_provider_idx').on(table.providerId, table.accountId),
}));

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  identifierIdx: index('verifications_identifier_idx').on(table.identifier),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

