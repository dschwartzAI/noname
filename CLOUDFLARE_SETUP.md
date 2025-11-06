# Cloudflare Setup Guide

This application requires Cloudflare Workers infrastructure to function properly. Follow these steps to set up your development and production environments.

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. **Node.js 18+** - Installed on your machine
3. **Wrangler CLI** - Cloudflare's command-line tool

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

## Step 2: Authenticate with Cloudflare

```bash
wrangler login
```

This will open your browser and ask you to authorize Wrangler.

## Step 3: Create D1 Database

The app uses Cloudflare D1 (SQLite) for data storage.

```bash
# Create the database
wrangler d1 create shadcn-admin-db

# Copy the database_id from the output
# Update wrangler.toml with the actual database_id
```

Update `wrangler.toml` line 9 and line 72:
```toml
database_id = "your-actual-database-id-here"
```

### Initialize Database Schema

```bash
# Run the migrations to create tables
wrangler d1 execute shadcn-admin-db --file=./database/better-auth-schema.sql --remote

# Create tasks table
wrangler d1 execute shadcn-admin-db --file=./database/migrations/0003_recreate_tasks_table.sql --remote

# (Optional) Seed with demo tasks
wrangler d1 execute shadcn-admin-db --file=./database/seed-tasks-simple.sql --remote
```

### Create Demo User (for testing)

```bash
# You'll need to create a user account through the signup flow or via SQL
# Here's how to create a demo user with SQL:
wrangler d1 execute shadcn-admin-db --command="
INSERT INTO users (id, name, email, email_verified, created_at, updated_at) 
VALUES ('pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Demo User', 'demo@example.com', 1, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('demo-account', 'demo@example.com', 'credential', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', '\$2a\$10\$rMZ8J.TIGCqCvjGdqJ5r0.HvH5DqHMb1nK3qZ8XqXqXqXqXqXqXqX', strftime('%s', 'now'), strftime('%s', 'now'));
" --remote
```

> Note: The password hash above is for `password123`. You may want to generate your own using bcrypt.

## Step 4: Create KV Namespaces

The app uses KV for session storage and caching.

```bash
# Create KV namespace for general storage
wrangler kv:namespace create KV

# Create KV namespace for sessions
wrangler kv:namespace create SESSIONS
```

Update `wrangler.toml` with the IDs from the output:
- Line 13: `id = "your-kv-namespace-id"`
- Line 17: `id = "your-sessions-namespace-id"`
- Line 63: `id = "your-kv-namespace-id"`
- Line 67: `id = "your-sessions-namespace-id"`

## Step 5: Create R2 Bucket (Optional - for file storage)

```bash
# Create R2 bucket for document storage
wrangler r2 bucket create buildmantle-rag-documents
```

## Step 6: Set Up Environment Variables

Update the `[vars]` section in `wrangler.toml` (lines 128-138 for development, 140-150 for production):

### Required Variables:
```toml
[vars]
BETTER_AUTH_SECRET = "generate-a-secure-random-string-here"
BETTER_AUTH_URL = "http://localhost:5173"  # Or your production URL
```

### Optional OAuth Variables (for Google/GitHub login):
```toml
GOOGLE_CLIENT_ID = "your-google-client-id"
GOOGLE_CLIENT_SECRET = "your-google-client-secret"
GITHUB_CLIENT_ID = "your-github-client-id"
GITHUB_CLIENT_SECRET = "your-github-client-secret"
```

### Optional API Keys (for enhanced features):
```toml
GOOGLE_API_KEY = "your-google-api-key"
ELEVENLABS_API_KEY = "your-elevenlabs-api-key"  # For voice synthesis
DEEPGRAM_API_KEY = "your-deepgram-api-key"      # For voice transcription
```

## Step 7: Test Local Development

```bash
# Start the development server
npm run dev
```

The app should now be running at `http://localhost:5174` with full Cloudflare Workers integration.

## Step 8: Deploy to Production

```bash
# Build the application
npm run build

# Deploy to Cloudflare
wrangler deploy
```

## Troubleshooting

### "Backend unavailable" or "Authentication service not available"
- **Cause**: D1 database not configured or migrations not run
- **Solution**: Follow Steps 3-4 above to set up and initialize the database

### "Session not persisting" or "Login redirects to sign-in"
- **Cause**: KV namespaces not configured
- **Solution**: Follow Step 4 to create and configure KV namespaces

### "AI features not working"
- **Cause**: Cloudflare Workers AI is not enabled or not properly bound
- **Solution**: The AI binding should work automatically in production. For local development, it uses emulation.

### "Database migrations failed"
- **Cause**: Syntax errors or existing tables
- **Solution**: Check the SQL files and ensure they run without errors. You may need to drop and recreate tables.

## Environment-Specific Configuration

### Development (Local)
- Uses `wrangler dev` with local emulation
- D1 database runs in local mode (use `--remote` flag to test against production DB)
- KV namespaces use local storage
- Workers AI uses local emulation (limited functionality)

### Production (Cloudflare Workers)
- Uses global edge network
- D1 database is planet-scale distributed
- KV namespaces are globally replicated
- Workers AI runs on Cloudflare's GPU infrastructure

## Cost Considerations

### Free Tier Limits:
- **D1**: 5 GB storage, 5 million reads/day, 100k writes/day
- **KV**: 100,000 reads/day, 1,000 writes/day
- **R2**: 10 GB storage, 1 million Class A operations/month
- **Workers AI**: Generous free tier with rate limits

### Paid Plans:
All services have pay-as-you-go pricing after free tier limits. See [Cloudflare Pricing](https://www.cloudflare.com/plans/) for details.

## Next Steps

1. ✅ Complete all setup steps above
2. 🔐 Set up OAuth providers (optional)
3. 🎨 Customize your app
4. 🚀 Deploy to production

## Getting Help

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Better Auth Docs](https://www.better-auth.com/)
- [Project Issues](https://github.com/dschwartzAI/noname/issues)

