# Migration Plan: LibreChat Fork → Vercel AI SDK

## Overview

**Strategy**: Parallel rebuild with phased feature migration

**Timeline**: 5-7 months for complete migration

**Approach**: 
1. Build new foundation in parallel (don't touch old system)
2. Migrate features one by one (feature flags for gradual rollout)
3. Run both systems briefly during transition
4. Sunset old system once confident

---

## Phase 0: Proof of Concept (Weeks 1-2)

### Goal: Validate new stack with minimal chat implementation

### Tasks

**1. Setup New Project**
```bash
# Create new repo
npx create-vite@latest solo-os-ai --template react-ts
cd solo-os-ai

# Install core dependencies
npm install @ai-sdk/openai ai
npm install hono @hono/node-server
npm install drizzle-orm @neondatabase/serverless
npm install @tanstack/react-router mobx mobx-react-lite
```

**2. Build Minimal Chat**
```typescript
// app/routes/chat.tsx
import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

**3. Build API Endpoint**
```typescript
// api/routes/chat.ts
import { Hono } from 'hono';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const app = new Hono();

app.post('/chat', async (c) => {
  const { messages } = await c.req.json();
  
  const result = streamText({
    model: openai('gpt-4'),
    messages,
  });
  
  return result.toDataStreamResponse();
});

export default app;
```

**4. Deploy POC**
```bash
# Deploy frontend to Vercel
vercel deploy

# Deploy API to Cloudflare Workers
wrangler deploy
```

### Success Criteria
- ✅ Chat streaming works
- ✅ Build time <60 seconds
- ✅ Deploy time <2 minutes
- ✅ Full TypeScript, no errors
- ✅ Vercel + Cloudflare integration works

**Decision Point**: If POC fails, reassess stack choice. Otherwise, proceed.

---

## Phase 1: Core Foundation (Weeks 3-6)

### Goal: Production-ready foundation for all features

### 1.1 Database Setup

**Tasks**:
- [ ] Create Neon Postgres database
- [ ] Define Drizzle schemas for core models
- [ ] Setup migrations
- [ ] Add row-level security (RLS) for multi-tenancy

**Schema Design**:
```typescript
// db/schema/users.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  tier: tierEnum('tier').default('free'),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// db/schema/conversations.ts
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  tenantId: uuid('tenant_id').notNull(), // Multi-tenancy!
  title: text('title'),
  agentId: text('agent_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// db/schema/messages.ts
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  tenantId: uuid('tenant_id').notNull(),
  content: text('content').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**RLS Policies**:
```sql
-- Tenant isolation via RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 1.2 Auth Setup

**Tasks**:
- [ ] Install Better Auth
- [ ] Configure OAuth providers (Google, GitHub)
- [ ] Setup JWT sessions
- [ ] Add role-based access control

**Config**:
```typescript
// auth/config.ts
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: true,
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
```

### 1.3 API Foundation

**Tasks**:
- [ ] Setup Hono app structure
- [ ] Add middleware (auth, tenant context, logging)
- [ ] Create base route structure
- [ ] Add error handling

**App Structure**:
```typescript
// api/index.ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.use('*', authMiddleware);
app.use('*', tenantMiddleware);

app.route('/api/auth', authRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/agents', agentRoutes);
// ... more routes

export default app;
```

### 1.4 Frontend Foundation

**Tasks**:
- [ ] Setup TanStack Router
- [ ] Configure MobX stores
- [ ] Install Shadcn UI components
- [ ] Create base layout
- [ ] Add dark mode support

**Router Setup**:
```typescript
// routes/index.tsx
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: RootLayout,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([chatRoute]),
});
```

**Store Setup**:
```typescript
// stores/chatStore.ts
import { makeObservable, observable, action } from 'mobx';

class ChatStore {
  @observable conversations = [];
  @observable activeConversation = null;
  
  @action setActiveConversation(id: string) {
    this.activeConversation = id;
  }
  
  constructor() {
    makeObservable(this);
  }
}

export const chatStore = new ChatStore();
```

---

## Phase 2: Core Chat Features (Weeks 7-10)

### Goal: Feature parity with current chat interface

### 2.1 Chat UI

**Tasks**:
- [ ] Implement AI Elements for message rendering
- [ ] Add streaming message display
- [ ] Add conversation sidebar
- [ ] Add model selector
- [ ] Add file upload UI
- [ ] Add message actions (edit, regenerate, copy)

**Using AI Elements**:
```typescript
// components/chat/MessageList.tsx
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';

export function MessageList({ messages }: { messages: Message[] }) {
  return messages.map((message) => (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        <Response>{message.content}</Response>
      </MessageContent>
    </Message>
  ));
}
```

### 2.2 Multi-Provider Support

**Tasks**:
- [ ] Add OpenAI provider
- [ ] Add Anthropic provider
- [ ] Add xAI (Grok) provider
- [ ] Add provider switching
- [ ] Add model selection per provider

**Provider Config**:
```typescript
// lib/ai/providers.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export const providers = {
  openai: {
    models: ['gpt-4', 'gpt-4o', 'gpt-4-turbo'],
    getModel: (model: string) => openai(model),
  },
  anthropic: {
    models: ['claude-3-opus', 'claude-3-sonnet'],
    getModel: (model: string) => anthropic(model),
  },
};
```

### 2.3 Conversation Management

**Tasks**:
- [ ] Create conversation CRUD operations
- [ ] Add conversation search
- [ ] Add conversation folders/tags
- [ ] Add conversation export
- [ ] Migrate existing conversations from MongoDB

**API Routes**:
```typescript
// api/routes/conversations.ts
app.get('/conversations', async (c) => {
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  
  const conversations = await db.query.conversations.findMany({
    where: and(
      eq(conversations.userId, userId),
      eq(conversations.tenantId, tenantId)
    ),
    orderBy: desc(conversations.createdAt),
  });
  
  return c.json({ conversations });
});
```

---

## Phase 3: Agent System (Weeks 11-14)

### Goal: Rebuild agent execution with Composio tools

### 3.1 Agent Configuration

**Tasks**:
- [ ] Define agent schemas in Postgres
- [ ] Build agent builder UI
- [ ] Add agent templates (Hybrid Offer, DCM, etc.)
- [ ] Add per-tenant agent isolation

**Schema**:
```typescript
// db/schema/agents.ts
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  instructions: text('instructions'),
  tools: jsonb('tools').$type<string[]>(),
  icon: text('icon'),
  tier: tierEnum('tier').default('free'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 3.2 Agent Execution

**Tasks**:
- [ ] Implement agent streaming with AI SDK
- [ ] Add tool execution
- [ ] Add memory injection
- [ ] Add error handling and retries

**Execution**:
```typescript
// api/routes/agents/execute.ts
import { streamText } from 'ai';
import { toolRegistry } from '@/lib/tools';

app.post('/agents/:id/execute', async (c) => {
  const agentId = c.req.param('id');
  const { messages } = await c.req.json();
  
  const agent = await getAgent(agentId);
  const model = providers[agent.provider].getModel(agent.model);
  
  // Load agent tools
  const tools = agent.tools.map(t => toolRegistry[t]);
  
  // Inject memory
  const memory = await getMemory(c.get('userId'));
  const systemPrompt = `${agent.instructions}\n\nMemory: ${memory}`;
  
  const result = streamText({
    model,
    tools,
    system: systemPrompt,
    messages,
  });
  
  return result.toDataStreamResponse();
});
```

### 3.3 Tool Integration (Composio)

**Tasks**:
- [ ] Setup Composio
- [ ] Migrate MCP tools to Composio
- [ ] Add GoHighLevel integration
- [ ] Add web search tool
- [ ] Add file search tool

**Composio Setup**:
```typescript
// lib/tools/composio.ts
import { composio } from 'composio-core';

export const toolRegistry = {
  web_search: composio.getTool('SERPER'),
  crm: composio.getTool('GOHIGHLEVEL'),
  file_search: createFileSearchTool(),
};
```

---

## Phase 4: Advanced Features (Weeks 15-18)

### 4.1 Memory System

**Tasks**:
- [ ] Port memory extraction logic
- [ ] Store memories in Postgres
- [ ] Add memory UI (view/edit memories)
- [ ] Migrate existing memories

**Schema**:
```typescript
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  tenantId: uuid('tenant_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  category: text('category'),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 4.2 RAG (File Search)

**Tasks**:
- [ ] Setup pgvector extension in Neon
- [ ] Implement document chunking
- [ ] Add embedding generation (OpenAI)
- [ ] Build vector search
- [ ] Add file upload handling

**Vector Search**:
```typescript
// lib/rag/search.ts
import { openai } from '@ai-sdk/openai';

export async function searchDocuments(query: string, fileId: string) {
  // Generate embedding
  const { embedding } = await openai.embedding('text-embedding-3-small', query);
  
  // Search vectors
  const results = await db.execute(sql`
    SELECT content, metadata, 
      (embedding <=> ${embedding}) as similarity
    FROM document_chunks
    WHERE file_id = ${fileId}
    ORDER BY similarity
    LIMIT 5
  `);
  
  return results;
}
```

### 4.3 File Management

**Tasks**:
- [ ] Setup Vercel Blob storage
- [ ] Implement file upload API
- [ ] Add file type validation
- [ ] Build file manager UI
- [ ] Migrate existing files from S3/DO Spaces

**Upload API**:
```typescript
// api/routes/files/upload.ts
import { put } from '@vercel/blob';

app.post('/files/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  
  const blob = await put(`${c.get('tenantId')}/${file.name}`, file, {
    access: 'public',
  });
  
  // Save to DB
  await db.insert(files).values({
    id: blob.url,
    tenantId: c.get('tenantId'),
    userId: c.get('userId'),
    filename: file.name,
    size: file.size,
    type: file.type,
  });
  
  return c.json({ file: blob });
});
```

---

## Phase 5: Third-Party Integrations (Weeks 19-21)

### 5.1 CometChat

**Decision**: Keep CometChat as-is initially

**Tasks**:
- [ ] Verify CometChat works with new auth
- [ ] Update user ID mapping
- [ ] Test integration
- [ ] (Optional) Explore Stream Chat as replacement later

### 5.2 Stream Video

**Decision**: Keep Stream Video as-is

**Tasks**:
- [ ] Migrate recording storage logic
- [ ] Update API routes for new backend
- [ ] Test video calls
- [ ] Verify recording pipeline

### 5.3 Stripe

**Decision**: Keep Stripe, migrate webhook handlers

**Tasks**:
- [ ] Port Stripe webhook logic to Hono
- [ ] Update checkout session creation
- [ ] Test payment flow
- [ ] Migrate transaction history

---

## Phase 6: LMS System (Weeks 22-24)

### 6.1 Course Schema

**Tasks**:
- [ ] Define course/module schemas in Postgres
- [ ] Migrate existing courses from MongoDB
- [ ] Build course admin UI
- [ ] Build student course viewer

**Schema**:
```typescript
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  instructor: text('instructor'),
  tier: tierEnum('tier').default('free'),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id),
  tenantId: uuid('tenant_id').notNull(),
  title: text('title').notNull(),
  videoUrl: text('video_url'),
  duration: integer('duration'),
  transcript: text('transcript'),
  order: integer('order'),
});
```

### 6.2 Video Integration

**Tasks**:
- [ ] Integrate Stream recordings
- [ ] Build module video player
- [ ] Add transcript display
- [ ] Test recording flow

---

## Phase 7: Multi-Tenancy & White-Label (Weeks 25-26)

### 7.1 Tenant Management

**Tasks**:
- [ ] Build tenant admin dashboard
- [ ] Add tenant creation flow
- [ ] Add tenant-specific configuration
- [ ] Add tenant usage analytics

**Tenant Schema**:
```typescript
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subdomain: text('subdomain').unique(),
  customDomain: text('custom_domain'),
  branding: jsonb('branding').$type<TenantBranding>(),
  config: jsonb('config').$type<TenantConfig>(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 7.2 White-Label UI

**Tasks**:
- [ ] Add tenant-specific branding
- [ ] Add custom domain support
- [ ] Add per-tenant agent customization
- [ ] Add per-tenant pricing

---

## Phase 8: Migration & Cutover (Weeks 27-28)

### 8.1 Data Migration

**Tasks**:
- [ ] Write migration scripts (MongoDB → Postgres)
- [ ] Migrate users
- [ ] Migrate conversations
- [ ] Migrate messages
- [ ] Migrate agents
- [ ] Migrate files metadata
- [ ] Verify data integrity

**Migration Script**:
```typescript
// scripts/migrate.ts
import { MongoClient } from 'mongodb';
import { db } from '@/db';

async function migrateUsers() {
  const mongo = await MongoClient.connect(MONGO_URI);
  const users = await mongo.db().collection('users').find().toArray();
  
  for (const user of users) {
    await db.insert(usersTable).values({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      tier: user.tier || 'free',
      tenantId: DEFAULT_TENANT_ID,
    });
  }
}
```

### 8.2 Parallel Running

**Tasks**:
- [ ] Run both systems in parallel
- [ ] Route new users to new system
- [ ] Keep existing users on old system
- [ ] Gradually migrate users
- [ ] Monitor for issues

**Feature Flag**:
```typescript
// Gradual rollout
const useNewSystem = user.createdAt > NEW_SYSTEM_LAUNCH_DATE || user.betaTester;
```

### 8.3 Cutover

**Tasks**:
- [ ] Migrate all users to new system
- [ ] Verify all features working
- [ ] Sunset old system
- [ ] Decommission old infrastructure

---

## Phase 9: Optimization & Polish (Weeks 29-30)

### 9.1 Performance

**Tasks**:
- [ ] Add database indexes
- [ ] Optimize queries
- [ ] Add caching (Redis/KV)
- [ ] Reduce bundle size
- [ ] Add CDN for assets

### 9.2 Monitoring

**Tasks**:
- [ ] Add error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Add usage analytics
- [ ] Set up alerting

### 9.3 Testing

**Tasks**:
- [ ] Add unit tests (Vitest)
- [ ] Add integration tests
- [ ] Add E2E tests (Playwright)
- [ ] Reach 80%+ coverage

---

## Risk Mitigation

### Risk 1: New Stack Learning Curve

**Mitigation**:
- Start with POC to learn
- Allocate extra time for unknowns
- Keep documentation as we learn
- Pair programming for knowledge sharing

### Risk 2: Data Migration Issues

**Mitigation**:
- Test migration on staging data first
- Write rollback scripts
- Migrate in batches (not all at once)
- Keep old system running during transition

### Risk 3: Feature Regression

**Mitigation**:
- Write comprehensive tests
- Manual QA checklist
- Beta testing with power users
- Feature flags for gradual rollout

### Risk 4: Third-Party Integration Breaks

**Mitigation**:
- Test CometChat/Stream early
- Keep integration points isolated
- Have fallback plans
- Vendor support contacts ready

---

## Success Metrics

### Technical Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Build Time | 5-15 min | <1 min | CI/CD timing |
| Bundle Size | 5.3MB | <2MB | Webpack analyzer |
| Cold Start | 5-10s | <500ms | Lambda logs |
| Type Coverage | 40% | 100% | `tsc --noEmit` |
| Test Coverage | 10% | 80% | Vitest coverage |
| API Latency (p95) | 500ms | <200ms | APM tools |

### Business Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Deploy Frequency | Weekly | Daily | Git commit logs |
| Time to Deploy | 20 min | <5 min | CI/CD timing |
| Production Incidents | 2-3/week | <1/week | Incident log |
| Dev Velocity | 1-2 features/week | 3-5 features/week | Sprint velocity |
| New Tenant Onboarding | N/A | <1 hour | Manual process |

---

## Rollback Plan

**If new system fails**:

1. **Immediate Actions**:
   - Switch traffic back to old system (DNS/routing)
   - Pause data migration
   - Preserve new system data for later analysis

2. **Post-Mortem**:
   - Analyze failure root cause
   - Fix issues in new system
   - Re-test thoroughly
   - Retry cutover

3. **Worst Case**:
   - Continue on old system
   - Incrementally adopt pieces of new stack
   - Delay full migration

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| 0: POC | 2 weeks | Working chat prototype |
| 1: Foundation | 4 weeks | Auth, DB, API structure |
| 2: Core Chat | 4 weeks | Feature parity with current chat |
| 3: Agents | 4 weeks | Agent system rebuilt |
| 4: Advanced Features | 4 weeks | Memory, RAG, files |
| 5: Integrations | 3 weeks | CometChat, Stream, Stripe |
| 6: LMS | 3 weeks | Course system rebuilt |
| 7: Multi-tenancy | 2 weeks | Tenant isolation, white-label |
| 8: Migration | 2 weeks | Data migration, cutover |
| 9: Polish | 2 weeks | Performance, testing |
| **Total** | **30 weeks (~7 months)** | |

---

## Team & Resources

**Recommended Team**:
- 1-2 Full-stack developers (focused on rebuild)
- 1 DevOps/infrastructure (CI/CD, deployment)
- 1 QA/testing (testing, migration validation)

**Part-time**:
- Product owner (requirements, priorities)
- Design (UI/UX for new features)

**External Support**:
- Vercel support (edge functions, deployment)
- Neon support (database optimization)
- Composio support (tool integrations)

---

**Next**: Review all documentation and begin Phase 0 POC!


