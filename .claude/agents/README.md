# Specialized Agents

This directory contains specialized agent definitions for Claude Code. Each agent provides domain-specific expertise and best practices for particular aspects of the codebase.

## Quick Reference

| Agent | Domain | Primary Use Cases |
|-------|--------|-------------------|
| **[Schema Architect](#schema-architect)** | Database Design | Multi-tenant schemas, pgvector, Drizzle ORM, migrations |
| **[API Engineer](#api-engineer)** | Backend APIs | Hono routes, Zod validation, oRPC, streaming, middleware |
| **[UI Builder](#ui-builder)** | Frontend Components | React 19, TanStack Router, Shadcn UI, forms, state |
| **[TypeScript Expert](#typescript-expert)** | Type Safety | Advanced types, generics, inference, type guards, Zod |
| **[TanStack Router Expert](#tanstack-router-expert)** | Routing & Navigation | File-based routing, loaders, search params, layouts |
| **[Performance Engineer](#performance-engineer)** | Optimization | Profiling, caching, bundle size, query optimization |
| **[Security Engineer](#security-engineer)** | Security & Auth | Multi-tenancy, auth flows, input validation, XSS/CSRF |
| **[Test Automator](#test-automator)** | Testing | Playwright E2E, integration tests, mocking, CI/CD |

---

## 🎯 How Agent Activation Works

### 4-Tier Activation System

**Tier 1: Explicit Request (ALWAYS Honored - Highest Priority)**

When you explicitly tell Claude to use a specific agent, it MUST comply immediately. This takes precedence over all other activation methods.

Examples:
```
"Use the TypeScript Expert agent to help with this"
"Ask the Schema Architect how to design this table"
"I need the Security Engineer to review this code"
"@api-engineer: Create an endpoint for user search"
"Please consult the Performance Engineer about this query"
```

**Any statement that clearly requests a specific agent by name will activate it.**

---

**Tier 2: Context-Aware (Automatic)**

Claude automatically activates agents when working in relevant files or encountering specific patterns:

- TypeScript errors in build output → **TypeScript Expert**
- Working in `database/schema/*.ts` → **Schema Architect**
- Working in `src/server/routes/*.ts` → **API Engineer**
- Working in `src/routes/*.tsx` → **UI Builder**
- Working in `tests/*.spec.ts` → **Test Automator**
- Authentication/session code → **Security Engineer**
- Slow query warnings → **Performance Engineer**

---

**Tier 3: Keyword Matching (Fallback)**

Traditional keyword-based activation when you mention relevant terms:

- "schema", "database", "migration" → **Schema Architect**
- "api", "endpoint", "middleware" → **API Engineer**
- "component", "ui", "form" → **UI Builder**
- "type", "interface", "generic" → **TypeScript Expert**
- "route", "navigation", "loader" → **TanStack Router Expert**
- "performance", "optimize", "cache" → **Performance Engineer**
- "security", "auth", "validation" → **Security Engineer**
- "test", "playwright", "e2e" → **Test Automator**

---

**Tier 4: Problem Recognition (Intelligent)**

Claude recognizes problem patterns and activates relevant agents:

- "How do I type this function?" → **TypeScript Expert**
- "This query is slow" → **Performance Engineer**
- "How do I protect this endpoint?" → **Security Engineer**
- "Need to validate user input" → **API Engineer + Security Engineer**
- "How do I test this AI feature?" → **Test Automator**

---

## Available Agents

### Schema Architect
**File**: [schema-architect.md](schema-architect.md)
**Domain**: Database schema design and Drizzle ORM

**Expertise**:
- Multi-tenant database design with `tenantId` isolation
- pgvector embeddings for RAG features (Neon Postgres)
- Drizzle ORM schema definition and relations
- Database migrations with `drizzle-kit`
- Index optimization and query performance
- UUID primary keys (never auto-increment)

**Use For**:
- Designing new tables with proper tenant isolation
- Adding vector columns for semantic search
- Creating or modifying schema files in `database/schema/`
- Planning database migrations
- Questions about Postgres features, indexes, or constraints

**Activation Examples**:
```
"Use Schema Architect to design a table for user memories"
"@schema-architect: How do I add pgvector embeddings?"
"Design a schema for conversations with proper multi-tenancy"
```

---

### API Engineer
**File**: [api-engineer.md](api-engineer.md)
**Domain**: Hono framework, REST API design, Cloudflare Workers

**Expertise**:
- Hono web framework with OpenAPI integration
- Zod validation with `.describe()` for oRPC auto-tool generation
- Cloudflare Workers runtime patterns
- Vercel AI SDK integration for streaming responses
- Middleware (auth, tenant context, error handling)
- HTTP status codes and REST best practices

**Use For**:
- Creating new API endpoints in `src/server/routes/`
- Adding Zod validation schemas
- Implementing middleware for auth or tenant filtering
- Streaming AI responses with `toDataStreamResponse()`
- Error handling and proper HTTP responses

**Activation Examples**:
```
"Use API Engineer to create a user search endpoint"
"@api-engineer: Add Zod validation for this route"
"How do I stream AI responses with Vercel AI SDK?"
```

**Critical Pattern**: ALL database queries MUST filter by `tenantId` for multi-tenant isolation

---

### UI Builder
**File**: [ui-builder.md](ui-builder.md)
**Domain**: React 19, TanStack Router, Shadcn UI, Legend State

**Expertise**:
- React 19 with TypeScript (Server Components ready)
- TanStack Router file-based routing with type safety
- Shadcn UI components (no custom UI from scratch)
- Legend State v3 for reactive state management
- React Hook Form + Zod for forms
- Vercel AI SDK UI components (`useChat`, `Message`, etc.)
- TanStack Query for server state

**Use For**:
- Building React components with Shadcn UI
- Creating TanStack Router routes in `src/routes/`
- Managing client state with Legend State
- Implementing forms with validation
- Using Vercel AI SDK chat components
- Responsive, accessible interfaces

**Activation Examples**:
```
"Use UI Builder to create a settings page"
"@ui-builder: Build a form for user preferences"
"How do I use useChat from Vercel AI SDK?"
```

---

### TypeScript Expert
**File**: [typescript-expert.md](typescript-expert.md)
**Domain**: Advanced TypeScript patterns and type safety

**Expertise**:
- Strict TypeScript configuration (`strict: true`, `noUncheckedIndexedAccess`)
- Result type pattern for API responses
- Discriminated unions with exhaustive checking
- Branded types for domain modeling
- Generic constraints and conditional types
- Template literal types and mapped types
- Type guards and custom type assertions
- Zod schema integration with type inference
- Utility types (`Partial`, `Required`, `Pick`, `Omit`)

**Use For**:
- Fixing TypeScript compilation errors
- Designing type-safe APIs and function signatures
- Creating branded types for IDs (UserId, TenantId)
- Implementing discriminated unions
- Inferring types from Zod schemas
- Writing type guards for runtime validation
- Advanced generic programming

**Activation Examples**:
```
"Use TypeScript Expert to fix these type errors"
"@typescript-expert: How do I create a branded type for UserId?"
"Help me infer types from this Zod schema"
```

---

### TanStack Router Expert
**File**: [tanstack-router-expert.md](tanstack-router-expert.md)
**Domain**: TanStack Router v7 patterns and best practices

**Expertise**:
- File-based routing with automatic route generation
- Type-safe navigation with `useNavigate()`
- Route loaders for data fetching
- Search param validation with Zod
- Nested layouts and route groups
- Protected routes with authentication
- Route-level code splitting
- Pending UI and loading states

**Use For**:
- Creating new routes in `src/routes/`
- Implementing route loaders with TanStack Query
- Type-safe navigation and search params
- Protected route patterns
- Layout composition
- Route-level data prefetching

**Activation Examples**:
```
"Use TanStack Router Expert to add a new route"
"@tanstack-router: How do I validate search params?"
"Create a protected route with authentication"
```

---

### Performance Engineer
**File**: [performance-engineer.md](performance-engineer.md)
**Domain**: Performance optimization and profiling

**Expertise**:
- React performance optimization (memoization, virtualization)
- Database query optimization (indexes, explain plans)
- Bundle size analysis and code splitting
- Caching strategies (browser, CDN, KV)
- Cloudflare Workers optimization (CPU time, memory)
- Image optimization (lazy loading, responsive images)
- TanStack Query caching patterns
- Profiling with Chrome DevTools

**Use For**:
- Investigating slow queries or page loads
- Reducing bundle size
- Implementing caching strategies
- Optimizing React renders
- Database index recommendations
- Improving Lighthouse scores

**Activation Examples**:
```
"Use Performance Engineer to optimize this query"
"@performance-engineer: Why is this page loading slowly?"
"How do I reduce the bundle size?"
```

---

### Security Engineer
**File**: [security-engineer.md](security-engineer.md)
**Domain**: Security, authentication, and multi-tenancy

**Expertise**:
- Multi-tenant data isolation (row-level security)
- Better Auth configuration and flows
- Input validation (XSS, SQL injection prevention)
- CSRF protection and secure headers
- Rate limiting with Cloudflare Workers
- Session management and token handling
- OAuth implementation (Google, GitHub)
- Content Security Policy (CSP)

**Use For**:
- Ensuring tenant isolation in queries
- Reviewing authentication flows
- Adding input validation
- Implementing rate limiting
- Security audits of API endpoints
- Protecting against OWASP Top 10

**Activation Examples**:
```
"Use Security Engineer to review this endpoint"
"@security-engineer: Is this query tenant-safe?"
"How do I validate user input securely?"
```

---

### Test Automator
**File**: [test-automator.md](test-automator.md)
**Domain**: E2E testing with Playwright

**Expertise**:
- Playwright E2E tests with TypeScript
- Testing AI chat interfaces with mock streaming
- Authentication flow testing
- Multi-browser testing (Chrome, Firefox, Safari)
- Test fixtures and page object models
- CI/CD integration with GitHub Actions
- Testing WebSocket connections
- Screenshot and video recording

**Use For**:
- Writing E2E tests for critical user flows
- Testing AI features with mock responses
- Testing authentication (OAuth, email/password)
- Cross-browser testing
- Debugging test failures
- Setting up CI/CD pipelines

**Activation Examples**:
```
"Use Test Automator to write tests for this feature"
"@test-automator: How do I test AI streaming?"
"Create E2E tests for the login flow"
```

---

## Collaboration Between Agents

Agents reference each other when their domains overlap:

### Schema Architect collaborates with:
- **API Engineer**: Provides type-safe queries from schema
- **UI Builder**: Exports TypeScript types for forms
- **Security Engineer**: Ensures tenant isolation in schema design

### API Engineer collaborates with:
- **Schema Architect**: Uses Drizzle queries from schema
- **TypeScript Expert**: Implements type-safe route handlers
- **Security Engineer**: Validates input and ensures auth

### UI Builder collaborates with:
- **API Engineer**: Consumes API types for client queries
- **TypeScript Expert**: Uses inferred types from Zod schemas
- **TanStack Router Expert**: Implements routes and navigation

### TypeScript Expert collaborates with:
- **All agents**: Provides type safety across the codebase

---

## Adding New Agents

To create a new specialized agent:

1. **Create agent file**: `.claude/agents/[agent-name].md`

2. **Define structure**:
   ```markdown
   # [Agent Name] Agent

   ## Role
   Brief description of the agent's purpose

   ## Activation Triggers

   ### Tier 1: Explicit Request (ALWAYS)
   - "Use the [Agent Name] agent"
   - "@agent-name: [task]"

   ### Tier 2: Context-Aware (Automatic)
   - Working in specific files/directories

   ### Tier 3: Keywords (Fallback)
   - List of relevant keywords

   ### Tier 4: Problem Recognition (Intelligent)
   - Common questions/problems this agent solves

   ## Expertise
   List of specialized knowledge areas

   ## Core Responsibilities
   What this agent ensures/enforces

   ## Templates/Patterns
   Reusable code patterns

   ## Example Prompts
   How to interact with this agent

   ## Collaboration
   Which agents this works with
   ```

3. **Update this README**: Add the agent to the Quick Reference table and Available Agents section

4. **Update CLAUDE.md**: Add reference to the new agent in the "Specialized Agents" section

---

## Agent Design Principles

**Good agents**:
- ✅ Have clear, narrow focus (database, API design, testing, etc.)
- ✅ Enforce critical patterns (multi-tenancy, type safety, security)
- ✅ Provide reusable templates and code examples
- ✅ Reference project-specific docs (`/REBUILD/`)
- ✅ Include validation checklists
- ✅ Support 4-tier activation (explicit → context → keywords → patterns)

**Avoid**:
- ❌ Generic advice that belongs in CLAUDE.md
- ❌ Overlapping responsibilities between agents
- ❌ Too broad scope (e.g., "full-stack developer agent")
- ❌ Ignoring explicit user requests to use an agent

---

## Agent Activation Best Practices

### For Users

**Want immediate, guaranteed activation?** Use Tier 1 explicit requests:
```
✅ "Use the [Agent Name] to..."
✅ "Ask the [Agent Name] about..."
✅ "@agent-name: [task]"
✅ "I need the [Agent Name]'s help with..."
```

**Prefer automatic activation?** Let Claude choose based on context, keywords, or problem patterns.

### For Claude Code

**Priority order when deciding which agent to invoke**:
1. **Tier 1 (Explicit Request)**: ALWAYS honor immediately, highest priority
2. **Tier 2 (Context-Aware)**: Auto-activate based on file paths
3. **Tier 3 (Keywords)**: Match based on mentioned terms
4. **Tier 4 (Patterns)**: Recognize problem types

**If user explicitly requests an agent, invoke it regardless of context or keywords.**

---

## Future Agent Ideas

Consider creating agents for:
- **AI Integrator**: Vercel AI SDK advanced patterns, tool orchestration, multi-step reasoning
- **Data Migration Specialist**: MongoDB → Postgres migration strategies
- **DevOps Engineer**: Cloudflare Workers deployment, Neon migrations, monitoring setup
- **Documentation Writer**: Generate docs from code, API reference, user guides

---

## Summary

This agent system provides specialized, domain-focused assistance across the entire codebase. The 4-tier activation ensures agents are invoked when needed—either explicitly by user request (highest priority), automatically by context, through keyword matching, or by recognizing problem patterns.

**Key takeaway**: When you explicitly ask for an agent by name, it will ALWAYS be activated immediately. No exceptions.
