/**
 * Calendar Events Schema
 * 
 * For the Syndicate LMS system - Calendar feature
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './auth';

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Event details
  title: text('title').notNull(),
  description: text('description'),
  
  // Type
  type: text('type').$type<'meeting' | 'class' | 'deadline' | 'event' | 'office_hours'>()
    .default('event')
    .notNull(),
  
  // Time
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  allDay: boolean('all_day').default(false),
  
  // Location
  location: text('location'),
  meetingUrl: text('meeting_url'),
  
  // Attendees
  attendees: jsonb('attendees').$type<Array<{
    userId: string;
    name: string;
    email: string;
    rsvp?: 'yes' | 'no' | 'maybe';
  }>>().default([]),
  
  // Recurrence
  recurring: boolean('recurring').default(false),
  recurrenceRule: jsonb('recurrence_rule').$type<{
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    until?: string;
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  }>(),
  
  // Reminders
  reminders: jsonb('reminders').$type<Array<{
    type: 'email' | 'notification';
    minutesBefore: number;
  }>>().default([]),
  
  // Metadata
  color: text('color').default('#3b82f6'), // For calendar UI
  category: text('category'),
  
  // Visibility
  visibility: text('visibility').$type<'public' | 'private' | 'organization'>()
    .default('organization')
    .notNull(),
  
  // Cancellation
  cancelled: boolean('cancelled').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Event RSVP tracking
export const eventRsvps = pgTable('event_rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .references(() => calendarEvents.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  response: text('response').$type<'yes' | 'no' | 'maybe'>().notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Types
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
export type SelectCalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertEventRsvp = typeof eventRsvps.$inferInsert;
export type SelectEventRsvp = typeof eventRsvps.$inferSelect;




