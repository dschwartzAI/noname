/**
 * Neon Postgres Database Connection
 * 
 * Replaces Cloudflare D1 with Neon's serverless Postgres
 * Includes support for pgvector and advanced Postgres features
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get Neon database connection
 * Singleton pattern to reuse connection
 */
export function getNeonDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please add your Neon connection string to .env.local'
      );
    }
    
    const sql = neon(databaseUrl);
    db = drizzle(sql, { 
      schema,
      logger: process.env.NODE_ENV === 'development'
    });
  }
  
  return db;
}

/**
 * Test database connection
 * Returns true if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getNeonDb();
    await db.execute('SELECT 1');
    console.log('✅ Neon database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Neon database connection failed:', error);
    return false;
  }
}

