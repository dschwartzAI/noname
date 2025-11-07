import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../../../database/better-auth-schema'
import type { Context } from 'hono'

/**
 * Get a database instance from the environment
 */
export function getDb(c: Context) {
  const sqlClient = neon(c.env.DATABASE_URL)
  return drizzle(sqlClient, { schema })
}

/**
 * Type for the database instance
 */
export type DbInstance = ReturnType<typeof getDb>
