# Specialized Agents

This directory contains specialized agent definitions for Claude Code. Each agent provides domain-specific expertise and best practices for particular aspects of the codebase.

## Available Agents

### 1. Schema Architect
**File**: [schema-architect.md](schema-architect.md)
**Domain**: Database schema design and Drizzle ORM

**Use for**:
- Designing multi-tenant database tables
- Adding pgvector embeddings for RAG
- Creating database migrations
- Postgres optimization (indexes, constraints)

**Activation**: Mention "schema", "database", "table", "migration", or "drizzle" in your request

### 2. API Engineer
**File**: [api-engineer.md](api-engineer.md)
**Domain**: Hono framework, REST API design, Cloudflare Workers

**Use for**:
- Creating API endpoints with Hono
- Adding Zod validation for oRPC auto-tool generation
- Implementing middleware (auth, tenant context)
- Streaming AI responses with Vercel AI SDK
- Error handling and HTTP status codes

**Activation**: Mention "api", "endpoint", "route", "worker", "hono", or "middleware" in your request

### 3. UI Builder
**File**: [ui-builder.md](ui-builder.md)
**Domain**: React 19, TanStack Router, Shadcn UI, Legend State

**Use for**:
- Building React components
- Creating TanStack Router routes
- Managing state with Legend State v3
- Implementing forms with React Hook Form + Zod
- Using Vercel AI SDK UI components (`useChat`, `Message`)

**Activation**: Mention "component", "ui", "frontend", "page", "react", "route", or "form" in your request

---

## How to Use Agents

### Method 1: Natural Language Triggers
Simply mention the relevant keywords in your request:

```
"I need to design a schema for storing user memories"
→ Automatically activates Schema Architect
```

### Method 2: Explicit Reference
Reference the agent directly in your prompt:

```
@schema-architect: Design a table for conversation messages with vector embeddings
```

### Method 3: Read Agent File
Have Claude Code read the agent file for context:

```
"Read .claude/agents/schema-architect.md and help me design a multi-tenant messages table"
```

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
   Keywords that activate this agent

   ## Expertise
   List of specialized knowledge areas

   ## Core Responsibilities
   What this agent ensures/enforces

   ## Templates/Patterns
   Reusable code patterns

   ## Example Prompts
   How to interact with this agent
   ```

3. **Update CLAUDE.md**: Add reference to the new agent in the "Specialized Agents" section

---

## Agent Design Principles

**Good agents**:
- ✅ Have clear, narrow focus (database, API design, testing, etc.)
- ✅ Enforce critical patterns (multi-tenancy, type safety, security)
- ✅ Provide reusable templates
- ✅ Reference project-specific docs (`/REBUILD/`)
- ✅ Include validation checklists

**Avoid**:
- ❌ Generic advice that belongs in CLAUDE.md
- ❌ Overlapping responsibilities between agents
- ❌ Too broad scope (e.g., "full-stack developer agent")

---

## Future Agent Ideas

Consider creating agents for:
- **AI Integrator**: Vercel AI SDK advanced patterns, tool orchestration, multi-step reasoning
- **Testing Specialist**: Playwright E2E, integration tests, mocking
- **Security Auditor**: Multi-tenancy checks, input validation, auth flows
- **DevOps**: Cloudflare Workers deployment, Neon migrations, monitoring
- **Data Migration**: MongoDB → Postgres migration strategies

---

## Collaboration Between Agents

Agents should reference each other when their domains overlap:

```markdown
## Collaboration

When working with other agents:
- **API Engineer**: Provide type-safe queries from schema
- **UI Builder**: Export TypeScript types for forms
- **AI Integrator**: Design vector columns for RAG features
```

This ensures a cohesive approach across the codebase.
