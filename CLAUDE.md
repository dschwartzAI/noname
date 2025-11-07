# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL CONTEXT: What We're Actually Building

**This is NOT just a template app.** This is a **LibreChat fork rebuild** - we're migrating a heavily customized AI business tools platform (Solo:OS) from a Docker-based LibreChat fork to a modern, multi-tenant SaaS architecture.

### The Real Project

**Current State**: LibreChat v0.7.9-rc1 fork with 100K+ lines of custom code
**Target State**: White-label AI platform for business coaches (multi-tenant SaaS)
**Timeline**: 4-month rebuild using this ShadFlareAi starter as the foundation

**Key Features Being Rebuilt**:
- Multi-AI chat with 8+ business agents (Hybrid Offer, DCM, ICP, etc.)
- Memory system for business context persistence
- RAG/file search with vector embeddings
- LMS (Academy) with course modules
- Community chat (replacing CometChat)
- Stripe payments with tiered access
- Stream video calls with recording

### Why This Starter?

We forked **ShadFlareAi** because it has 90% of the infrastructure we need:
- ✅ React 19 + TypeScript + Vite
- ✅ Hono backend (edge-compatible)
- ✅ Better Auth + Drizzle ORM
- ✅ Vercel AI SDK integration
- ✅ Shadcn UI components

**What We're Adding**:
- Multi-tenancy (tenant isolation, white-label branding)
- oRPC auto-tool generation from API endpoints
- Business agent system with tool orchestration
- Memory + RAG with pgvector (Neon Postgres)
- LMS features + community chat
- Data migration from MongoDB to Postgres

📚 **Complete rebuild documentation**: See `/REBUILD/` folder for:
- Architecture diagrams (current vs target)
- Feature inventory with migration strategies
- Week-by-week implementation guide
- Database schemas and API endpoints

## 🎯 Development Principles

### Modular Architecture Strategy

**IMPORTANT**: Build each major feature as a **self-contained, routable module**. This makes the codebase:
- ✅ Easier for LLMs to understand and modify
- ✅ Portable between projects
- ✅ Maintainable with clear boundaries
- ✅ Testable in isolation

**Pattern**: Each feature gets its own route and is accessed via routing
```
src/routes/_authenticated/
├── ai-chat/           # AI chat feature (self-contained)
├── agents/            # Agent management (self-contained)
├── rag-knowledge/     # RAG/file search (self-contained)
├── academy/           # LMS features (self-contained)
└── settings/          # Settings (self-contained)
```

### Code Efficiency & Verification

**Claude Code MUST**:
1. **Write minimal code** - Use existing libraries and components, don't reinvent
2. **Verify before implementing** - Check documentation for APIs, libraries, and patterns
3. **No hallucination** - If you're unsure, ask or look it up. Don't guess.
4. **Use existing patterns** - Follow patterns from `/REBUILD/` docs and existing codebase
5. **Reference documentation** - Check official docs for Vercel AI SDK, Hono, Drizzle, etc.

**Example - Good vs Bad**:
```typescript
// ❌ BAD: Writing custom streaming logic
function customStream(text: string) {
  // 50 lines of custom SSE code...
}

// ✅ GOOD: Using Vercel AI SDK
import { streamText } from 'ai';
const result = streamText({ model, messages });
return result.toDataStreamResponse();
```

### Documentation-First Development

Before implementing ANY feature:
1. Check `/REBUILD/` docs for migration strategy
2. Review official library documentation
3. Look for existing patterns in the codebase
4. Ask the user if multiple valid approaches exist

**Never**:
- Guess at API signatures
- Assume library capabilities without checking
- Implement workarounds when built-in solutions exist
- Create abstractions without understanding the underlying APIs

## Commands

### Development
- `npm run dev` - Start both frontend (Vite) and backend (Wrangler) with auto-restart via `dev-servers.sh`
- `npm run dev:frontend` - Start Vite frontend only (port 5174)
- `npm run dev:backend` - Start Wrangler backend only (port 8788)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run knip` - Find unused dependencies and exports

### Development Server Management
**Recommended**: Use `npm run dev` which runs `dev-servers.sh` with auto-restart on crashes.

The `dev-servers.sh` script:
- Starts both frontend (Vite on 5174) and backend (Wrangler on 8788)
- Auto-restarts servers on crash (no manual intervention needed)
- Runs servers in background with log files
- Logs: `/tmp/vite.log` and `/tmp/wrangler.log`
- Kill with: `pkill -f "wrangler dev" && pkill -f "vite"`

**Important**: Frontend proxies `/api` requests to backend via `vite.config.ts` proxy configuration.

### Cloudflare Workers
- `wrangler deploy` - Deploy to Cloudflare Workers
- `wrangler secret put <NAME>` - Add a single secret to production
- `./add-secrets.sh` - Batch upload all secrets from `.dev.vars` to Cloudflare
- `wrangler secret list` - List all secrets (values hidden)
- `wrangler secret delete <NAME>` - Remove a secret

### Cloudflare R2 (Object Storage)
- `wrangler r2 bucket create <BUCKET_NAME>` - Create new R2 bucket
- `wrangler r2 bucket list` - List all R2 buckets
- R2.dev URL format: `https://pub-<hash>.r2.dev/<key>` (automatically generated)

**Organization**: Use folder structure in R2 for different asset types:
- `logos/` - Organization logos
- `favicons/` - Organization favicons  
- `avatars/` - User avatars
- `documents/` - User uploaded files

## Architecture

**Foundation**: ShadFlareAi starter template - a production-ready Cloudflare Workers + AI admin dashboard

**Our Customizations**: Rebuilding a LibreChat fork into a multi-tenant white-label AI platform for business coaches

📖 **Detailed Architecture Documentation**: See [/REBUILD/architecture.md](REBUILD/architecture.md) for:
- Current LibreChat fork architecture (what we're migrating from)
- Target architecture diagrams with data flows
- oRPC integration patterns for auto-tool generation
- Composio integration for external services
- Multi-tenancy design with row-level security

### Technology Stack

### Frontend Stack
- **React 19** with **TypeScript** for the UI
- **TanStack Router** for file-based routing with type safety
- **TanStack Query** for server state management
- **Zustand** for client state management
- **Legend State v3** for reactive state management with WebSocket integration
- **Vercel AI SDK** (`@ai-sdk/react`, `@ai-sdk/ui`) for AI chat components and streaming
- **ShadcnUI** + **TailwindCSS** for styling with RTL support
- **Radix UI** for accessible components

### Backend Stack
- **Cloudflare Workers** for serverless compute
- **Hono** with **OpenAPI** integration for the web framework
- **D1** for the database (SQLite)
- **KV** for key-value storage
- **Better Auth** for authentication with OpenAPI documentation
- **Drizzle ORM** for database operations
- **Cloudflare AI** for AI chat functionality (OpenAI-compatible API)
- **Cloudflare Workers AI** for text generation, embeddings, and image processing
- **Durable Objects** for real-time WebSocket connections and stateful operations
- **Cloudflare R2** for object storage and file uploads
- **Cloudflare Pages** integration for static asset serving

### Key Architecture Patterns

1. **Feature-Based Organization**: Code is organized by features in `src/features/` (auth, dashboard, tasks, users, etc.)

2. **Routing Structure**: 
   - TanStack Router with file-based routing in `src/routes/`
   - `_authenticated/` routes require authentication
   - `(auth)/` and `(errors)/` are route groups

3. **Component Architecture**:
   - Reusable UI components in `src/components/ui/` (ShadcnUI)
   - Layout components in `src/components/layout/`
   - Feature-specific components within each feature directory

4. **Data Layer**:
   - TanStack Query for server state with React Query DevTools
   - Custom hooks for data fetching patterns
   - Type-safe API calls with Zod validation

5. **Authentication Flow**:
   - Better Auth configured for email/password and OAuth (Google, GitHub)
   - Protected routes with authentication context
   - Session management with KV storage

6. **Cloudflare Integration**:
   - Worker entry point in `worker.ts` using Hono
   - API functions in `functions/api/` directory
   - Environment bindings for D1, KV, AI, and auth secrets

## Important Configuration

### Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)

### ESLint Rules
- Uses TypeScript ESLint with React hooks and TanStack Query plugins
- Enforces type-only imports with inline syntax
- No console.log statements in production
- Strict unused variable checking with underscore prefix exception

### Database
- Uses D1 (Cloudflare's SQLite) with Drizzle ORM
- Schema and migrations in `database/` directory
- Local development uses file-based SQLite

### Modified ShadcnUI Components
The following components have been customized for RTL support and should not be updated via Shadcn CLI without reviewing changes:
- **Modified**: scroll-area, sonner, separator
- **RTL Updated**: alert-dialog, calendar, command, dialog, dropdown-menu, select, table, sheet, sidebar, switch

### Development Integration
The `@cloudflare/vite-plugin` provides seamless integration between Vite and the Cloudflare Workers runtime:

- **Native HMR**: Hot Module Replacement works for both client and server code
- **Integrated Runtime**: Worker code runs in workerd (same as production) during development
- **No Proxy Needed**: API routes are handled directly by Vite, no separate wrangler dev process required
- **Environment Parity**: Development environment matches production Cloudflare Workers runtime
- **SPA Fallback**: Client-side routing works correctly - direct URL navigation is supported

**Critical Configuration**:
- Remove any server proxy configuration from vite.config.ts - the plugin handles routing internally
- Set `appType: 'spa'` in vite.config.ts for proper SPA fallback
- The worker handles SPA fallback by serving index.html for non-API routes when ASSETS is unavailable (development)

## API Documentation

The application uses OpenAPI documentation with interactive testing:

- **API Docs**: `http://localhost:5174/api/ui` - Swagger UI for all endpoints
- **Auth Docs**: `http://localhost:5174/api/auth/reference` - Better Auth endpoints
- **OpenAPI Schema**: `http://localhost:5174/api/docs` - JSON specification

New routes defined in `src/server/routes/` with Zod schemas automatically appear in documentation.

## Authentication & Testing

### Test User Credentials
For development and testing purposes:
- **Email**: `demo@example.com`  
- **Password**: `password123`

**Note**: Users must be created via Better Auth API. Use this curl command to create new test users:
```bash
curl -X POST http://localhost:5174/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123", "name": "New User"}'
```

### Sign-in Methods
1. **OAuth (GitHub/Google)**: Currently returns 404 - OAuth providers need configuration
2. **Email/Password**: Working with test credentials above
3. **Account Creation**: Better Auth handles user registration automatically on first successful OAuth or can be done via API

### Authentication Flow
- Better Auth manages sessions with database hooks for real-time WebSocket invalidation
- Legend State v3 provides reactive auth state management
- Sessions are stored in Cloudflare KV with automatic expiry
- WebSocket connections via UserSysDO provide cross-device session invalidation

### Backend API Testing with Session Cookies
For testing authenticated API endpoints, extract session cookies after login:

```bash
# 1. Sign in and capture cookies
curl -X POST http://localhost:5174/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "password": "password123"}' \
  -c cookies.txt

# 2. Use session cookies for authenticated requests
curl -X GET http://localhost:5174/api/protected-endpoint \
  -b cookies.txt

# 3. Test WebSocket authentication
curl -X GET http://localhost:5174/api/auth/session \
  -b cookies.txt
```

**Cookie Storage**: Sessions persist in `cookies.txt` for easy reuse in testing scripts

## Testing Strategy

### Testing Commands

```bash
# Playwright E2E tests
npm test                    # Run all tests
npm run test:headed         # Run with browser UI visible
npm run test:artifacts      # Test artifact generation features
npm run test:artifacts:headed  # Test artifacts with browser visible
```

### Test Structure

```
tests/
├── artifacts-gemini.spec.ts   # AI artifact generation tests
└── (add more test files as features are built)
```

### Testing Approach

**For New Features**:
1. Write E2E tests with Playwright for critical user flows
2. Test AI features with mock streaming responses
3. Test multi-tenancy isolation (data leakage prevention)
4. Test authentication flows with test credentials

**Test Credentials** (from Authentication & Testing section):
- Email: `demo@example.com`
- Password: `password123`

### AI Feature Testing

When testing AI features:
```typescript
// Mock AI responses in tests
test('agent completes tool call', async ({ page }) => {
  // Navigate to chat
  await page.goto('/ai-chat');

  // Send message that triggers tool
  await page.fill('[data-testid="message-input"]', 'Search for users named John');
  await page.click('[data-testid="send-button"]');

  // Wait for tool execution
  await page.waitForSelector('[data-testid="tool-result"]');

  // Verify tool was called correctly
  const result = await page.textContent('[data-testid="tool-result"]');
  expect(result).toContain('Found 3 users');
});
```

## Session Planning & Tracking

Claude should maintain session documentation in `sessions/YYYY-MM-DD/session-N/`:
- **plan.md**: Track goals, progress, and next steps
- **work-log.md**: Log activities and decisions
- **session-summary.md**: Summarize accomplishments (auto-generated on Stop)

### Session Configuration
- **Session Port**: [AUTO-ASSIGNED] (note the port when starting dev server to avoid conflicts)

### Working Guidelines
1. Update plan.md when starting new tasks
2. Mark goals with ✅ when completed
3. Add discovered tasks as new goals
4. Commit code after logical chunks of work


## Project Configuration

### Package Manager
- [x] npm
- [ ] yarn  
- [ ] pnpm
- [ ] pip
- [ ] cargo
- [ ] other: ___________

### Framework & Stack
- **Frontend**: React 19 + TypeScript + Vite + ShadcnUI + Vercel AI SDK
- **Backend**: Cloudflare Workers + Hono + OpenAPI
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth**: Better Auth with OAuth (Google, GitHub)
- **Deployment**: Cloudflare Workers + Pages

### Development Commands
```bash
# Install dependencies
npm install

# Run development server (includes Workers runtime) - QUIET MODE BY DEFAULT
npm run dev

# Run with verbose logging (all logs)
npm run log:verbose

# Focus logging on specific areas
npm run log:websocket  # WebSocket debugging
npm run log:ai         # AI operations only
npm run log:voice      # Voice features only

# Run tests
npm test

# Build for production
npm run build

# Lint and format
npm run lint && npm run format

# Type checking
npx tsc --noEmit
```

### Logging System
- **Default Mode**: Quiet (only errors) - reduces WebSocket/AI noise
- **Runtime Control**: `logControl.focus('ai')` in browser console  
- **Contexts**: websocket, ai, voice, auth, ui, data, artifacts, performance
- **Documentation**: See `LOGGING.md` for complete guide

### Ports & Services
- **Frontend**: http://localhost:[VITE_DYNAMIC_PORT] (default 5174, auto-assigned by Vite)
- **Backend API**: http://localhost:[SAME_PORT]/api  
- **Database**: Cloudflare D1 (local SQLite in development)
- **Other services**: WebSocket connections via Durable Objects


## Testing Strategy

### Test Structure
```
tests/
├── unit/        # Unit tests
├── integration/ # Integration tests
├── e2e/         # End-to-end tests
└── fixtures/    # Test data
```

### Testing Commands
- **Unit tests**: `npm test` (Vitest)
- **Integration tests**: `npm run test:integration` (API + Workers)
- **E2E tests**: `npm run test:e2e` (Playwright + Playwright MCP)
- **Coverage**: `npm run test:coverage`

### Testing Requirements
- [x] All new features must have tests
- [x] Maintain >80% code coverage
- [x] Run tests before committing
- [x] E2E tests for critical user flows
- [x] AI component testing with mock streaming responses
- [x] WebSocket connection testing for real-time features

### E2E Testing with Playwright MCP
- **MCP Integration**: Use `mcp__playwright__*` tools for browser automation
- **AI Feature Testing**: Test chat interfaces, voice features, and artifact generation
- **Authentication Flows**: Test OAuth and email/password sign-in with test credentials
- **Cross-browser Testing**: Chrome, Firefox, Safari support via MCP


## Authentication & Security

### Auth Implementation
- **Method**: [x] JWT [x] Session [x] OAuth [ ] Other: _____
- **Provider**: [x] Custom (Better Auth) [ ] Auth0 [ ] Clerk [ ] Supabase [ ] Firebase
- **MFA**: [ ] Enabled [x] Optional [ ] Not implemented
- **OAuth Providers**: Google, GitHub (configurable)

### Security Checklist
- [x] Input validation on all endpoints (Zod schemas)
- [x] SQL injection prevention (Drizzle ORM parameterized queries)
- [x] XSS protection (React built-in + CSP headers)
- [x] CSRF tokens (Better Auth handled)
- [x] Rate limiting (Cloudflare Workers built-in)
- [x] Secure headers (Hono security middleware)
- [x] Environment variables for secrets (Cloudflare secrets)


## API Structure

### REST Endpoints
```
GET    /api/[resource]      # List
GET    /api/[resource]/:id  # Get one
POST   /api/[resource]      # Create
PUT    /api/[resource]/:id  # Update
DELETE /api/[resource]/:id  # Delete
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "error": null,
  "metadata": {}
}
```


## Database Schema

📖 **Complete Schema Documentation**: See [/REBUILD/data-models.md](REBUILD/data-models.md) for full table definitions and relationships

### Key Tables (Neon Postgres + pgvector)

**Multi-Tenancy Foundation**:
```typescript
tenants        // White-label tenant configuration
  ├── id, subdomain, name, config (branding, features, limits)

users          // Tenant-scoped users
  ├── id, tenantId, email, tier (free/pro), role

conversations  // AI chat conversations
  ├── id, tenantId, userId, agentId, title

messages       // Chat messages with branching support
  ├── id, conversationId, tenantId, content, role, parentId
```

**AI Features**:
```typescript
agents         // Business agents (Hybrid Offer, DCM, ICP, etc.)
  ├── id, tenantId, name, instructions, model, tools[], parameters

memories       // Business context with vector search
  ├── id, tenantId, userId, content, type, embedding (vector)

files          // Uploaded documents
  ├── id, tenantId, userId, name, url, mimeType, size

document_chunks // RAG with pgvector for semantic search
  ├── id, fileId, tenantId, content, embedding (vector 1536), metadata
```

**LMS & Community**:
```typescript
courses        // Academy course modules
  ├── id, tenantId, title, modules (jsonb), tier, published

course_progress // User progress tracking
  ├── id, tenantId, userId, courseId, completedModules[], percentage
```

### Vector Search with pgvector

Built-in semantic search using Neon's pgvector extension:
```sql
-- RAG similarity search
SELECT content, (embedding <=> query_embedding) as similarity
FROM document_chunks
WHERE tenant_id = $1
ORDER BY similarity ASC
LIMIT 5;
```

### Migrations
- **Tool**: Drizzle Kit for Neon Postgres (NOT Cloudflare D1)
- **Location**: `database/migrations/` directory
- **Commands**:
  ```bash
  npx drizzle-kit generate  # Generate migration from schema changes
  npx drizzle-kit push      # Apply to database
  ```

### Row-Level Security

All tables include `tenant_id` for automatic isolation:
```typescript
// Every query MUST filter by tenant
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, tenantId),  // Tenant isolation
    eq(conversations.userId, userId)
  )
});
```


## Environment Variables

### Required Variables
```env
# Development
NODE_ENV=development

# Cloudflare Bindings (automatically injected in Workers)
# D1_DATABASE=your-d1-database
# KV_STORE=your-kv-namespace  
# AI_BINDING=@cf/workers-ai
# R2_BUCKET=your-r2-bucket

# Auth Secrets (Cloudflare secrets)
# AUTH_SECRET=your-secret-key
# GOOGLE_CLIENT_ID=your-google-oauth-id
# GOOGLE_CLIENT_SECRET=your-google-oauth-secret  
# GITHUB_CLIENT_ID=your-github-oauth-id
# GITHUB_CLIENT_SECRET=your-github-oauth-secret
```

### Setup Instructions
1. Configure `wrangler.toml` with your Cloudflare account details
2. Set Cloudflare secrets using: `wrangler secret put <SECRET_NAME>`
3. Create D1 database: `wrangler d1 create <DB_NAME>`
4. Set up KV namespace: `wrangler kv:namespace create <NAMESPACE_NAME>`
5. Never commit secrets or keys to repository


## Code Style & Conventions

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Components**: `PascalCase.tsx`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **CSS Classes**: `kebab-case`

### File Organization
```
src/
├── components/   # Reusable components
├── pages/        # Route pages
├── lib/          # Utilities
├── hooks/        # Custom hooks
├── types/        # TypeScript types
├── styles/       # Global styles
└── api/          # API routes/handlers
```

### Git Configuration
- **Current Branch**: main
- **Main Branch**: main

### Git Commit Format
```
[type]: brief description

Types: feat, fix, docs, style, refactor, test, chore
```


## Deployment

### Deployment Platform
- [ ] Vercel
- [ ] Netlify
- [ ] AWS
- [ ] Heroku
- [ ] Railway
- [x] Other: **Cloudflare Workers + Pages**

### CI/CD Pipeline
- [x] GitHub Actions (Cloudflare Workers deployment)
- [ ] GitLab CI
- [ ] CircleCI
- [ ] Jenkins
- [ ] Other: _____________

### Production Checklist
- [x] Environment variables configured (Cloudflare secrets)
- [x] Database migrations run (D1)
- [x] SSL certificates active (Cloudflare managed)
- [x] Monitoring setup (Cloudflare Analytics + Workers analytics)
- [x] Error tracking enabled (Hono error handling + Cloudflare logs)
- [x] Backups configured (D1 automatic backups)


## Monitoring & Logging

### Error Tracking
- **Service**: [ ] Sentry [ ] Bugsnag [ ] Rollbar [x] Custom (Cloudflare Workers analytics)
- **DSN**: Built-in Cloudflare Workers error reporting

### Analytics
- **Service**: [ ] GA4 [ ] Posthog [ ] Mixpanel [ ] Plausible [x] Cloudflare Web Analytics
- **ID**: Configured in Cloudflare dashboard

### Logging
- **Level**: [x] Debug [x] Info [x] Warn [x] Error
- **Destination**: [x] Console [x] File [x] Cloud service (Cloudflare Logpush)


## Performance Requirements

### Load Time Targets
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Largest Contentful Paint**: < 2.5s

### Optimization Checklist
- [x] Code splitting implemented (Vite + TanStack Router)
- [x] Images optimized (Cloudflare Image Resizing + R2)
- [x] Lazy loading enabled (React.lazy + TanStack Router)
- [x] Caching strategy defined (Cloudflare CDN + KV + browser cache)
- [x] Database queries optimized (Drizzle ORM + D1 prepared statements)


## Branding & Asset Management

### Organization Branding Features

This app supports per-organization customization for white-label multi-tenancy:

#### Logo Management
- **Location**: Admin > Settings > Branding > Logo
- **Display**: Sidebar, app header, login pages
- **Storage**: R2 bucket under `logos/` folder
- **Size Limit**: 5MB max, square recommended
- **Database**: `organization.logo` (TEXT field with R2 URL)

#### Favicon Management
- **Location**: Admin > Settings > Branding > Favicon
- **Display**: Browser tabs, bookmarks
- **Storage**: R2 bucket under `favicons/` folder
- **Size Limit**: 1MB max, 32x32px or 64x64px recommended
- **Database**: `organization.favicon` (TEXT field with R2 URL)
- **Dynamic Updates**: `DynamicFavicon` component updates favicon without page reload

#### Implementation Pattern: Reusable Image Upload

When adding new image upload features:

1. **Use `ImageUpload` component** (`src/routes/_authenticated/admin/_components/image-upload.tsx`)
   - Handles file selection, preview, validation
   - Type-safe with configurable field names
   - Automatic R2 upload + database update

2. **Create field-specific wrapper**:
```typescript
export function AvatarUpload() {
  const { data: orgData } = useQuery({...});
  
  return (
    <ImageUpload
      currentImage={orgData.organization.avatar}
      organizationId={orgData.organization.id}
      fieldName="avatar"
      label="Avatar"
      description="Profile picture"
      maxSizeMB={2}
    />
  );
}
```

3. **Backend support**:
   - Upload endpoint: `/api/organization/logo/upload` (handles all image types via `type` param)
   - Update endpoint: PATCH `/api/organization/:id` must accept new field
   - R2 folder structure: `${type}s/${orgId}-${timestamp}.${ext}`

4. **Database**:
   - Add TEXT column: `ALTER TABLE organization ADD COLUMN <field> TEXT;`
   - Update schema: `database/better-auth-schema.ts`

#### Asset Organization Best Practices

- **Single R2 Bucket**: Use one `app-assets` bucket with folder organization
- **Folder Structure**: `logos/`, `favicons/`, `avatars/`, `documents/`
- **Naming Convention**: `${orgId}-${timestamp}.${extension}` for uniqueness
- **Size Validation**: Enforce limits at upload time (logos: 5MB, favicons: 1MB)
- **Type Validation**: Only allow image types for branding assets

## Project-Specific Instructions

### Cloudflare AI Showcase Features

This template demonstrates the full breadth of Cloudflare's capabilities:

#### AI & ML Features
- **Text Generation**: Using `@cf/meta/llama-2-7b-chat-int8` and OpenAI-compatible endpoints
- **Image Generation**: Integration with `@cf/stabilityai/stable-diffusion-xl-base-1.0`
- **Text Embeddings**: Vector search with `@cf/baai/bge-base-en-v1.5`
- **Audio Transcription**: Speech-to-text with `@cf/openai/whisper`
- **Real-time AI Chat**: WebSocket-based chat with streaming responses

#### Cloudflare Infrastructure Showcase
- **Workers**: Serverless compute with sub-10ms cold starts
- **D1**: Planet-scale SQLite database with global replication
- **KV**: Global key-value storage for sessions and cache
- **R2**: Object storage for user uploads and generated content
- **Durable Objects**: Stateful WebSocket connections and real-time features
- **Pages**: Static site hosting with SPA fallback
- **CDN**: Global content delivery and caching

#### Vercel AI SDK Integration
- **Components**: `useChat`, `useCompletion`, `useAssistant` hooks
- **Streaming UI**: Real-time message rendering with proper loading states
- **Tool Calling**: Function calling capabilities with schema validation
- **Image Generation UI**: Interactive image generation with progress indicators

#### Template Usage Guidelines
1. **Feature Demonstration**: Each route showcases specific Cloudflare + AI capabilities
2. **Code Examples**: Well-documented patterns for common AI/cloud integrations
3. **Performance**: Optimized for Cloudflare's edge computing model
4. **Scalability**: Designed to handle production workloads across global regions

#### Development Workflow
- Use `npm run dev` for full-stack development with hot reload
- Test AI features with mock responses in development
- Deploy incrementally using `wrangler deploy`
- Monitor performance using Cloudflare Analytics dashboard

---

## 📚 Quick Reference: Implementation Guides

When implementing specific features, **always check these docs first**:

### Architecture & Patterns
- **[/REBUILD/architecture.md](REBUILD/architecture.md)** - System architecture, data flows, oRPC patterns
- **[/REBUILD/features.md](REBUILD/features.md)** - Complete feature catalog with code examples
- **[/REBUILD/starter-integration.md](REBUILD/starter-integration.md)** - Week-by-week implementation guide

### Data & API
- **[/REBUILD/data-models.md](REBUILD/data-models.md)** - Database schemas with Drizzle examples
- **[/REBUILD/api-endpoints.md](REBUILD/api-endpoints.md)** - API endpoint documentation
- **[/REBUILD/tech-stack.md](REBUILD/tech-stack.md)** - Technology decisions and comparisons

### Migration Context
- **[/REBUILD/README.md](REBUILD/README.md)** - Project overview and quick facts
- **[/REBUILD/EXECUTIVE_SUMMARY.md](REBUILD/EXECUTIVE_SUMMARY.md)** - Business context and why we're rebuilding
- **[/REBUILD/migration-plan.md](REBUILD/migration-plan.md)** - Phased migration strategy

### Key Implementation Patterns

**When building a new feature route**:
1. Check `/REBUILD/features.md` for migration strategy from LibreChat
2. Follow modular pattern in `src/routes/_authenticated/`
3. Use existing components from `src/components/ui/`
4. Reference similar routes for patterns

**When adding AI/agent features**:
1. Review oRPC patterns in `/REBUILD/architecture.md`
2. Check Vercel AI SDK docs (don't guess at API signatures)
3. Use Composio for external services (GitHub, Gmail, etc.)
4. See agent examples in `/REBUILD/features.md` → Section 2

**When working with database**:
1. ALL tables must have `tenantId` for isolation
2. Use Drizzle ORM patterns from `/REBUILD/data-models.md`
3. Vector search uses pgvector (see examples in data-models.md)
4. Generate migrations with `npx drizzle-kit generate`

**When adding API endpoints**:
1. Use Zod validation for all inputs (enables oRPC auto-tool generation)
2. Add `.describe()` to Zod fields (becomes tool parameter descriptions)
3. Inject tenant context via middleware (see `/REBUILD/starter-integration.md` Week 3-4)
4. Check `/REBUILD/api-endpoints.md` for endpoint patterns

---

## 🚨 Critical Reminders

1. **Always filter by tenantId** - Data isolation is critical for multi-tenant SaaS
2. **Check REBUILD docs before implementing** - Avoid reinventing solutions
3. **Use Vercel AI SDK patterns** - Don't write custom streaming logic
4. **Verify with official docs** - No hallucinating API signatures
5. **Keep features modular** - Each major feature should be route-based and portable

---

## 🤖 Specialized Agents

This project uses 8 specialized agents for domain-specific tasks. Each agent provides expert guidance and enforces best practices in their area.

📚 **Complete Agent Documentation**: See [.claude/agents/README.md](.claude/agents/README.md)

### Quick Reference

| Agent | Domain | Activation |
|-------|--------|------------|
| **Schema Architect** | Database Design | "schema", "database", "migration", "drizzle" |
| **API Engineer** | Backend APIs | "api", "endpoint", "route", "middleware" |
| **UI Builder** | Frontend Components | "ui", "component", "react", "form" |
| **TypeScript Expert** | Type Safety | "type", "interface", "generic", "inference" |
| **TanStack Router Expert** | Routing | "route", "navigation", "loader", "search params" |
| **Performance Engineer** | Optimization | "performance", "optimize", "cache", "slow" |
| **Security Engineer** | Security & Auth | "security", "auth", "validation", "tenant" |
| **Test Automator** | Testing | "test", "playwright", "e2e", "mock" |

### How to Invoke Agents

**Tier 1: Explicit Request (ALWAYS Honored)**
```
"Use the [Agent Name] to..."
"Ask the [Agent Name] about..."
"@agent-name: [task]"
```

**Tier 2: Context-Aware**
- Working in `database/schema/` → Schema Architect
- Working in `src/server/routes/` → API Engineer
- Working in `src/routes/` → UI Builder
- TypeScript errors → TypeScript Expert

**Tier 3: Keywords**
- Mention relevant keywords (see Quick Reference table)

**Tier 4: Problem Recognition**
- "How do I type this?" → TypeScript Expert
- "This query is slow" → Performance Engineer
- "How do I protect this?" → Security Engineer

**For complete agent profiles, activation examples, and collaboration patterns, see [.claude/agents/README.md](.claude/agents/README.md)**

---

## 🔧 Troubleshooting Guide

### Common Development Issues

#### Backend API Returns 500 or Features Don't Work

**Symptom**: API endpoints fail, features don't work as expected, or you see connection errors.

**Cause**: Backend (Wrangler) is not running or crashed.

**Solution**:
```bash
# Check if backend is running
curl -s http://localhost:8788/ > /dev/null && echo "✅ Backend OK" || echo "❌ Backend down"

# Restart dev servers
npm run dev
```

**Prevention**: Use `npm run dev` which auto-restarts crashed servers via `dev-servers.sh`.

#### Image Upload Succeeds But Data Not Saving

**Symptom**: Toast shows "Upload successful" but data doesn't persist or display.

**Cause**: Backend PATCH endpoint doesn't accept the new field.

**Solution**:
```typescript
// In src/server/routes/organization.ts
const updateData: any = {};
if (updates.logo !== undefined) updateData.logo = updates.logo;
if (updates.favicon !== undefined) updateData.favicon = updates.favicon; // ADD THIS
if (updates.newField !== undefined) updateData.newField = updates.newField; // ADD NEW FIELDS
```

**Pattern**: Always update PATCH endpoint when adding new organization fields.

#### Secrets Not Working After Update

**Symptom**: API keys don't work after rotating them.

**Cause**: Secrets in `.dev.vars` updated but not uploaded to Cloudflare.

**Solution**:
```bash
# Re-upload all secrets from .dev.vars
./add-secrets.sh

# Verify secrets are uploaded
npx wrangler secret list
```

**Remember**: 
- `.dev.vars` = local development (auto-loaded)
- Cloudflare Secrets = production (must upload via Wrangler)

#### R2 Uploads Fail or Files Not Found

**Symptom**: File upload returns 500 or uploaded files return 404.

**Cause**: R2 bucket not configured or wrong bucket name.

**Solution**:
```bash
# Check R2 configuration in wrangler.toml
cat wrangler.toml | grep -A 3 "r2_buckets"

# Verify bucket exists
wrangler r2 bucket list

# Create bucket if missing
wrangler r2 bucket create app-assets
```

**Check**: 
- `wrangler.toml` has correct `bucket_name`
- `R2_PUBLIC_URL` is set (for serving files)
- Backend code uses correct binding name (`c.env.R2_ASSETS`)

#### Session Doesn't Persist After Restart

**Symptom**: User logged out after restarting dev servers.

**Cause**: Sessions stored in local KV, not remote Cloudflare KV.

**Solution**: Already configured! Development uses remote KV with `remote = true` in `wrangler.toml`:
```toml
[[env.development.kv_namespaces]]
binding = "SESSIONS"
id = "ba789d2e87b7422baf321c2d7aa85c99"
remote = true  # This persists sessions
```

#### Frontend Can't Reach Backend API

**Symptom**: `/api/*` requests fail with connection refused or 404.

**Cause**: Vite proxy not configured or wrong port.

**Solution**: Check `vite.config.ts`:
```typescript
server: {
  port: 5174,
  proxy: {
    '/api': {
      target: 'http://localhost:8788',
      changeOrigin: true,
    },
  },
}
```

**Verify**: Backend is running on 8788, frontend on 5174.

### Debug Logging

When troubleshooting, add console logs to trace execution:

```typescript
// Backend (Hono)
console.log('📤 Upload started', { userId: user.id, fileName: file.name });

// Frontend (React)
console.log('🔍 Component rendered', { orgId, currentLogo });
```

**Tip**: Use emoji prefixes for easy log scanning:
- 📤 Upload operations
- 🔍 Data fetching
- ✅ Success states
- ❌ Error states
- 🔗 API calls

### Getting Help

When reporting issues:
1. Check relevant log file: `/tmp/vite.log` or `/tmp/wrangler.log`
2. Include error messages from browser console
3. Verify all prerequisites (R2 bucket, secrets, KV namespaces)
4. Test with curl to isolate frontend vs backend issues
