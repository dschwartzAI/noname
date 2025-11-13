/**
 * Database Schema Index
 *
 * Exports all table schemas for Neon Postgres
 */

export * from '../better-auth-schema';

// AI Chat System
export * from './conversations';
export * from './messages';
export * from './agents';
export * from './memories';
export * from './knowledge-base';

// LMS System (Syndicate)
export * from './tenants';
export * from './instructors';
export * from './courses';
// Temporarily disabled due to import path issues
// export * from './calendar';
// export * from './message-board';

