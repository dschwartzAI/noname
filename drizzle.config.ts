import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './database/schema/index.ts',
  out: './database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

