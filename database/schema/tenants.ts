/**
 * Tenants Schema - Multi-tenancy Support
 * 
 * Each tenant represents a separate organization/company using the platform
 * with isolated data and custom branding
 */

import { pgTable, text, uuid, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Basic info
  name: text('name').notNull(),
  subdomain: text('subdomain').unique().notNull(),
  
  // White-label configuration
  config: jsonb('config').$type<{
    branding: {
      logo: string;
      primaryColor: string;
      secondaryColor?: string;
      companyName: string;
      favicon?: string;
    };
    features: {
      agents: boolean;
      rag: boolean;
      memory: boolean;
      composio: boolean;
    };
    limits: {
      maxUsers: number;
      maxAgents: number;
      maxStorage: number; // in bytes
      maxApiCalls: number; // per month
    };
  }>().default({
    branding: {
      logo: '/logo.png',
      primaryColor: '#000000',
      companyName: 'Solo OS'
    },
    features: {
      agents: true,
      rag: true,
      memory: true,
      composio: false
    },
    limits: {
      maxUsers: 10,
      maxAgents: 5,
      maxStorage: 1024 * 1024 * 1024, // 1GB
      maxApiCalls: 10000
    }
  }),
  
  // Subscription
  tier: text('tier').$type<'free' | 'pro' | 'enterprise'>().default('free').notNull(),
  active: boolean('active').default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  subdomainIdx: index('tenants_subdomain_idx').on(table.subdomain),
  activeIdx: index('tenants_active_idx').on(table.active),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

