import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous, openAPI } from 'better-auth/plugins';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../database/better-auth-schema';

export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export function createAuth(env: Env) {
  // Check if DATABASE_URL is available
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Please configure the Neon database connection string.');
  }

  console.log('Initializing Better Auth with Neon Postgres...');
  
  // Use Neon Postgres with HTTP driver (serverless-friendly)
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    emailAndPassword: {
      enabled: true,
      // Add required email verification config
      requireEmailVerification: false, // Set to true if you want email verification
    },
    plugins: [anonymous(), openAPI()],
    secret: env.BETTER_AUTH_SECRET || 'CPmXy0XgIWaOICeanyyFhR5eFwyQgoSJ0LpGtgJrpHc=',
    baseURL: env.BETTER_AUTH_URL || 'https://shadcn-admin-cf-ai.dan-ccc.workers.dev',
    
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
    
    socialProviders: {
      google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      } : undefined,
      github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET
      } : undefined,
    },
  });
}