import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const instructors = pgTable('instructors', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  title: text('title'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
  tenantIdx: index('instructors_tenant_id_idx').on(table.tenantId),
}))

export type InsertInstructor = typeof instructors.$inferInsert
export type SelectInstructor = typeof instructors.$inferSelect
