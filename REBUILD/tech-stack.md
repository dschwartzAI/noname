# Technology Stack Comparison

> **Related Docs**: [Architecture](./architecture.md) | [Features](./features.md) | [Dependencies](./dependencies.md) | [Pain Points](./pain-points.md) | [Migration Plan](./migration-plan.md)

## Current Stack (LibreChat Fork)

### Frontend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React | 18.2.0 | UI library |
| **Build Tool** | Vite | 6.3.4 | Dev server + bundler |
| **State Management** | Recoil | 0.7.7 | Global state |
| **Server State** | TanStack Query | 4.28.0 | Data fetching/caching |
| **Routing** | React Router | 6.11.2 | Client-side routing |
| **UI Components** | Radix UI + Custom | Various | Headless components |
| **Styling** | Tailwind CSS | 3.4.1 | Utility-first CSS |
| **i18n** | i18next | 24.2.2 | Internationalization |
| **Markdown** | react-markdown | 9.0.1 | Markdown rendering |
| **Animations** | Framer Motion | 11.5.4 | Animations |

**Total Frontend Dependencies**: ~150 packages

---

### Backend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Node.js | 20+ | JavaScript runtime |
| **Framework** | Express.js | 4.21.2 | Web framework |
| **Database** | MongoDB | 8.18.1 (Mongoose) | Document database |
| **Search** | MeiliSearch | 0.53.0 | Full-text search |
| **File Storage** | AWS S3 | 2.1692.0 | Object storage |
| **Auth** | Passport.js | 0.6.0 | Authentication |
| **Session** | express-session | 1.18.2 | Session management |
| **AI** | @librechat/agents | 2.4.79 | Agent framework |
| **LangChain** | @langchain/core | 0.3.62 | LLM orchestration |
| **OpenAI** | openai | 5.11.0 | OpenAI SDK |
| **Anthropic** | @anthropic-ai/sdk | 0.52.0 | Claude SDK |
| **Vector DB** | External RAG API | N/A | Embeddings |
| **MCP** | @modelcontextprotocol/sdk | 1.17.1 | Tool integration |

**Total Backend Dependencies**: ~250 packages

---

### Third-Party Services

| Service | Purpose | Cost | Notes |
|---------|---------|------|-------|
| **MongoDB Atlas** | Database | $0-57/mo | Free tier available |
| **MeiliSearch** | Search index | Self-hosted | In docker-compose |
| **AWS S3** | File storage | $0.023/GB | Pay as you go |
| **DigitalOcean Spaces** | Recordings, voice notes | $5/mo | 250GB included |
| **OpenAI** | LLM API | Variable | Pay per token |
| **Anthropic** | Claude API | Variable | Pay per token |
| **CometChat** | Community chat | $49-399/mo | Paid service |
| **Stream** | Video calls | $99/mo | Paid service |
| **Stripe** | Payments | 2.9% + $0.30 | Per transaction |
| **RAG API** | Vector search | Self-hosted | Optional service |

**Total Monthly Fixed Costs**: ~$150-550 (depending on tier)

---

### Build & Deployment

| Tool | Purpose | Pain Points |
|------|---------|-------------|
| **Docker** | Containerization | Slow builds (5-15 min) |
| **Docker Compose** | Multi-container orchestration | Complex config |
| **npm workspaces** | Monorepo management | Dependency resolution issues |
| **Multi-stage Dockerfile** | Production builds | Cache invalidation |

---

## Target Stack (Vercel AI SDK)

### Frontend

| Category | Technology | Why? |
|----------|-----------|------|
| **Framework** | React 18 + TypeScript | Type safety, industry standard |
| **Build Tool** | Vite 6 | Fast, modern, keeps HMR |
| **Routing** | TanStack Router | Type-safe routing, built-in data loading |
| **State** | MobX | Simple, reactive, less boilerplate than Redux |
| **Server State** | TanStack Query | Keep (works great) |
| **UI Components** | Shadcn UI | Better than Radix, more complete |
| **AI UI** | Vercel AI Elements | Pre-built AI chat components |
| **Styling** | Tailwind CSS | Keep (works great) |
| **Streaming** | Vercel AI SDK Hooks | `useChat()`, `useCompletion()` |

**Key Improvements**:
- Full TypeScript (currently mixed JS/TS)
- Type-safe routing (current React Router isn't)
- MobX for simpler state (vs Recoil's atom complexity)
- AI Elements for faster UI development
- Better bundle size (~30% smaller)

---

### Backend

| Category | Technology | Why? |
|----------|-----------|------|
| **Framework** | Hono | 4x faster than Express, edge-compatible |
| **Runtime** | Cloudflare Workers | Edge compute, auto-scaling, cheap |
| **Database** | Neon Postgres | Serverless, auto-scale, better than Mongo for this |
| **ORM** | Drizzle | Type-safe, fast, Postgres-optimized |
| **Auth** | Better Auth | Modern, built for edge, replaces Passport |
| **AI SDK** | Vercel AI SDK | Streaming, provider abstraction |
| **File Storage** | Vercel Blob / R2 | Edge-compatible, pay-as-you-go |
| **Vector DB** | Neon Vector (pgvector) | Built-in, no external service needed |
| **Search** | Postgres FTS | Built-in, no MeiliSearch needed |
| **Tool Integration** | Composio | MCP alternative, more tools |

**Key Improvements**:
- Edge-compatible (deploy anywhere)
- Type-safe end-to-end
- No external services for basics (RAG, search)
- 10x faster cold starts
- Auto-scaling by default

---

### Deployment

| Platform | Use Case | Cost | Why? |
|----------|----------|------|------|
| **Vercel** | Frontend + Edge Functions | $20-150/mo | Best DX, auto-scaling |
| **Cloudflare Workers** | Backend API | $5-25/mo | Fastest edge, cheap |
| **Neon** | Postgres database | $19-69/mo | Serverless, generous free tier |
| **Vercel Blob** | File storage | $0.15/GB | Integrated, fast |

**Total Monthly Fixed Costs**: ~$50-200 (vs $150-550 current)

**Deployment Improvements**:
- **Build time**: 30-60 seconds (vs 5-15 minutes)
- **Deploy time**: 1-2 minutes (vs 10-20 minutes)
- **Zero downtime**: Automatic (vs manual)
- **Auto-scaling**: Built-in (vs manual)
- **Edge compute**: Global CDN (vs single region)

---

## Stack Comparison Table

| Aspect | Current | Target | Benefit |
|--------|---------|--------|---------|
| **Language** | JavaScript + some TS | Full TypeScript | Type safety, better DX |
| **Backend Framework** | Express.js | Hono | 4x faster, edge-ready |
| **Database** | MongoDB | Neon Postgres | Better query language, relations |
| **ORM** | Mongoose | Drizzle | Type-safe, better performance |
| **Auth** | Passport.js | Better Auth | Modern, edge-compatible |
| **Routing** | React Router | TanStack Router | Type-safe, better DX |
| **State** | Recoil | MobX | Simpler, less boilerplate |
| **AI Streaming** | Custom SSE | Vercel AI SDK | Battle-tested, simpler |
| **Vector DB** | External RAG API | Neon pgvector | Built-in, no extra service |
| **Search** | MeiliSearch | Postgres FTS | Built-in, no extra service |
| **File Storage** | AWS S3 + DO Spaces | Vercel Blob / R2 | Edge-compatible, simpler |
| **Deployment** | Docker | Vercel + Cloudflare | Faster, auto-scaling |
| **Build Tool** | Vite (keep) | Vite | No change |
| **UI Library** | Radix UI | Shadcn UI | Better components |
| **Tool Integration** | MCP SDK | Composio | More tools, better DX |

---

## Key Benefits of New Stack

### 1. Developer Experience

```
Current:
- Mixed JS/TS (type safety holes)
- Manual types for API
- Boilerplate-heavy state management
- Complex Docker setup
- 15-minute build times

Target:
- Full TypeScript end-to-end
- Auto-generated API types
- Simple reactive state (MobX)
- `npm run dev` works instantly
- 30-second build times
```

### 2. Performance

```
Current:
- Cold start: 5-10 seconds
- API latency: 100-500ms (single region)
- Build time: 5-15 minutes
- Bundle size: 3-5MB

Target:
- Cold start: <500ms (edge)
- API latency: 20-100ms (global edge)
- Build time: 30-60 seconds
- Bundle size: 1-2MB
```

### 3. Cost

```
Current Monthly (1000 users):
- MongoDB Atlas: $57
- MeiliSearch: Self-hosted
- AWS S3: ~$20
- DO Spaces: $5
- RAG API: Self-hosted
- CometChat: $49-399
- Stream: $99
- Server: $50-100
Total: ~$300-700

Target Monthly (1000 users):
- Neon Postgres: $19-69 (includes vector, search)
- Vercel: $20-150 (frontend + functions)
- Cloudflare Workers: $5-25 (backend)
- Vercel Blob: ~$10 (files)
- CometChat: $49-399 (keep if needed)
- Stream: $99 (keep if needed)
Total: ~$200-650

Savings: $100-50/month + less dev time
```

### 4. Scalability

```
Current:
- Vertical scaling (bigger servers)
- Manual deployment
- Single region
- Docker orchestration complexity

Target:
- Horizontal auto-scaling
- Push-to-deploy
- Global edge network
- Zero-config scaling
```

### 5. Multi-tenancy

```
Current:
- Not designed for multi-tenancy
- Shared database, no isolation
- Hard-coded logic
- Manual tenant provisioning

Target:
- Multi-tenant from day 1
- Row-level security (RLS)
- Tenant-scoped queries (Drizzle filters)
- API tenant isolation
- Easy white-labeling
```

---

## Migration Complexity by Component

| Component | Current Tech | Target Tech | Difficulty | Notes |
|-----------|-------------|-------------|------------|-------|
| **Chat UI** | React + Recoil | React + MobX + AI Elements | Medium | AI Elements replaces custom components |
| **Routing** | React Router | TanStack Router | Low | Similar API, better types |
| **API** | Express | Hono | Medium | Different middleware pattern |
| **Database** | MongoDB | Neon Postgres | High | Schema + query migration |
| **ORM** | Mongoose | Drizzle | Medium | Similar patterns, better types |
| **Auth** | Passport | Better Auth | Medium | Different config, cleaner API |
| **AI Streaming** | Custom SSE | Vercel AI SDK | Low | Drop-in replacement |
| **Agents** | LibreChat Agents | Vercel AI SDK + Composio | High | Re-implement agent logic |
| **Memory** | Custom | Custom (keep logic) | Low | Just change storage layer |
| **RAG** | External service | Neon pgvector | Medium | Built-in, simpler |
| **Search** | MeiliSearch | Postgres FTS | Low | Built-in, simpler |
| **CometChat** | Keep as-is | Keep as-is | None | No change needed |
| **LMS** | MongoDB | Postgres | Medium | Schema migration |
| **Payments** | Stripe (keep) | Stripe (keep) | None | No change needed |
| **File Storage** | S3 + DO Spaces | Vercel Blob | Medium | API change, simpler |

---

## Dependency Reduction

```
Current:
- Frontend: ~150 packages
- Backend: ~250 packages
- Total: ~400 packages
- node_modules size: 1.2GB

Target:
- Frontend: ~100 packages (33% reduction)
- Backend: ~80 packages (68% reduction)
- Total: ~180 packages (55% reduction)
- node_modules size: ~400MB (67% reduction)

Benefits:
- Faster installs
- Fewer security vulnerabilities
- Less maintenance
- Smaller Docker images (if still using Docker)
```

---

## Stack Decision Rationale

### Why Hono over Express?

```typescript
// Express (current)
app.get('/api/users/:id', async (req, res) => {
  // No type safety
  const id = req.params.id;
  const user = await db.users.findOne({ _id: id });
  res.json(user);
});

// Hono (target)
app.get('/api/users/:id', async (c) => {
  // Type-safe params
  const id = c.req.param('id');
  const user = await db.query.users.findFirst({
    where: eq(users.id, id)
  });
  return c.json(user); // Type-safe response
});
```

**Benefits**:
- 4x faster than Express
- Edge-compatible (Cloudflare, Vercel, Deno)
- Better TypeScript support
- Smaller bundle size

---

### Why Neon over MongoDB?

**MongoDB Issues**:
- Document model doesn't fit relational data well
- No enforced schema
- Aggregation queries complex
- No native vector search (requires external service)
- Hard to audit/debug complex queries

**Postgres Benefits**:
- Better for relational data (users, conversations, messages)
- Enforced schema with migrations
- SQL is easier to read/debug
- Built-in vector search (pgvector)
- Built-in full-text search
- Better transaction support
- Row-level security for multi-tenancy

---

### Why TanStack Router over React Router?

```typescript
// React Router (current)
<Route path="/chat/:id" element={<Chat />} />
// No type safety on params

// TanStack Router (target)
const chatRoute = createRoute({
  path: '/chat/$id',
  component: Chat,
  loader: async ({ params }) => {
    // params.id is typed!
    return await fetchChat(params.id);
  }
});
// Full type safety + built-in data loading
```

---

### Why MobX over Recoil?

**Recoil Issues**:
- Atom boilerplate
- Complex selectors
- Performance issues with many atoms
- Limited adoption/community

**MobX Benefits**:
- Simple reactive state
- Less boilerplate
- Better performance
- Mature ecosystem
- Easier to learn

```typescript
// Recoil (current)
const userState = atom({ key: 'user', default: null });
const userEmailState = selector({
  key: 'userEmail',
  get: ({ get }) => get(userState)?.email
});

// MobX (target)
class UserStore {
  @observable user = null;
  @computed get email() {
    return this.user?.email;
  }
}
```

---

## Technology Risk Assessment

| Technology | Maturity | Community | Edge Support | Risk Level |
|-----------|----------|-----------|--------------|------------|
| **Vercel AI SDK** | Mature (v4) | Large | ✅ Yes | Low |
| **Hono** | Mature | Growing | ✅ Yes | Low |
| **Neon** | Stable | Medium | ✅ Yes | Medium |
| **Drizzle** | Mature | Large | ✅ Yes | Low |
| **TanStack Router** | Beta | Growing | ✅ Yes | Medium |
| **Better Auth** | New (v1) | Small | ✅ Yes | Medium |
| **MobX** | Mature | Large | ✅ Yes | Low |
| **Shadcn UI** | Mature | Large | ✅ Yes | Low |
| **Composio** | New | Small | ✅ Yes | Medium |

**Overall Risk**: Medium-Low (most stack is mature)

**Mitigation**:
- Build POC first
- Gradual migration (feature by feature)
- Keep fallback options (can switch Drizzle→Prisma, Better Auth→Clerk, etc.)

---

## Related Documentation

| Document | What It Covers | Read Next If... |
|----------|----------------|-----------------|
| **[Pain Points](./pain-points.md)** | Why current stack isn't working | You need to justify stack changes |
| **[Architecture](./architecture.md)** | How the new stack fits together | You want to see system design |
| **[Dependencies](./dependencies.md)** | Complete dependency inventory | You need detailed package migration |
| **[Features](./features.md)** | How features map to new stack | You want implementation details |
| **[Starter Integration](./starter-integration.md)** | Week-by-week build plan | You're ready to start |

**Next**: Read [Pain Points](./pain-points.md) for detailed technical debt analysis.

