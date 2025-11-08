/**
 * Courses Schema
 * 
 * For the Syndicate LMS system - Classroom feature
 */

import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './auth';

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  
  // Instructor
  instructor: text('instructor').notNull(),
  instructorBio: text('instructor_bio'),
  instructorAvatar: text('instructor_avatar'),
  
  // Access
  tier: text('tier').$type<'free' | 'pro'>().default('free').notNull(),
  published: boolean('published').default(false),
  
  // Stats
  enrollmentCount: integer('enrollment_count').default(0),
  
  // Order
  order: integer('order').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  
  // Order
  order: integer('order').default(0),
  published: boolean('published').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id')
    .references(() => modules.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  
  // Video
  videoUrl: text('video_url'),
  videoProvider: text('video_provider').$type<'youtube' | 'vimeo' | 'cloudflare' | 'custom'>(),
  duration: integer('duration'), // seconds
  thumbnail: text('thumbnail'),
  
  // Transcript
  transcript: text('transcript'),
  transcriptUrl: text('transcript_url'),
  
  // Recording metadata
  recordingMetadata: jsonb('recording_metadata').$type<{
    streamRecordingId?: string;
    recordingDate?: string;
    isEvergreen?: boolean;
    storage?: string;
  }>(),
  
  // Resources
  resources: jsonb('resources').$type<Array<{
    id: string;
    name: string;
    url: string;
    type: 'pdf' | 'document' | 'link' | 'file';
  }>>().default([]),
  
  // Access
  published: boolean('published').default(false),
  order: integer('order').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// User progress tracking
export const courseEnrollments = pgTable('course_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Progress tracking
  completedLessons: jsonb('completed_lessons').$type<string[]>().default([]),
  lastAccessedLessonId: uuid('last_accessed_lesson_id'),
  progressPercentage: integer('progress_percentage').default(0),
  
  // Timestamps
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Lesson completion tracking
export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  lessonId: uuid('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Progress
  completed: boolean('completed').default(false),
  watchTimeSeconds: integer('watch_time_seconds').default(0),
  lastWatchPosition: integer('last_watch_position').default(0), // seconds
  
  // Timestamps
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Types
export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;
export type SelectModule = typeof modules.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;
export type SelectLesson = typeof lessons.$inferSelect;
export type InsertCourseEnrollment = typeof courseEnrollments.$inferInsert;
export type SelectCourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertLessonProgress = typeof lessonProgress.$inferInsert;
export type SelectLessonProgress = typeof lessonProgress.$inferSelect;




