import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous, openAPI } from 'better-auth/plugins';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// This is the main Better Auth configuration file
// Used by the CLI for schema generation and by the application at runtime

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(neon(process.env.DATABASE_URL!)), {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [anonymous(), openAPI()],
  secret: process.env.BETTER_AUTH_SECRET || 'CPmXy0XgIWaOICeanyyFhR5eFwyQgoSJ0LpGtgJrpHc=',
  baseURL: process.env.BETTER_AUTH_URL || 'https://shadcn-admin-cf-ai.dan-ccc.workers.dev',
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  socialProviders: {
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    } : undefined,
    github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    } : undefined,
  },
});

