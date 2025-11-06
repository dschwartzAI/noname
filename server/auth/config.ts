import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { withCloudflare } from 'better-auth-cloudflare';
import { anonymous, openAPI } from 'better-auth/plugins';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../database/schema';
import type { Env } from '../src/server/index';
import { authLog } from '../src/lib/logger';

const authLogger = authLog('server/auth/config.ts');

export function createAuth(env: Env) {
  // Use Neon Postgres with HTTP driver
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema, logger: true });
  
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [anonymous(), openAPI()],
    rateLimit: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET || 'default-dev-secret-change-in-production',
    baseURL: env.BETTER_AUTH_URL || 'https://shadcn-admin-cf-ai.dan-ccc.workers.dev',
    
    // Use KV for session storage
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