# ShadFlareAi Integration Guide (4-Month Rebuild)

## Executive Summary

**Fork [ShadFlareAi](https://github.com/codevibesmatter/ShadFlareAi)** and adapt it instead of building from scratch.

**Timeline**: 16 weeks (4 months)  
**Cost**: ~$150K (2 devs)  
**Savings**: 3 months, $120K vs from-scratch

---

## Week-by-Week Implementation

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Setup & Database Migration

**Day 1-2: Fork and Local Setup**

```bash
# Fork the repo
git clone https://github.com/YOUR_USERNAME/ShadFlareAi.git solo-os
cd solo-os
npm install
npm run dev
```

**Day 3-5: Setup Neon Postgres**

```bash
# 1. Create Neon project at https://neon.tech
# 2. Get connection string

# 3. Update database config
# Create .env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/solo_os?sslmode=require"

# 4. Install Neon dependencies (already in ShadFlareAi)
npm install @neondatabase/serverless drizzle-orm dotenv
```

**Replace D1 with Neon**:

```typescript
// database/db.ts - BEFORE (D1)
import { drizzle } from 'drizzle-orm/d1';

export function getDb(env: Env) {
  return drizzle(env.DB);
}
```

```typescript
// database/db.ts - AFTER (Neon)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql);
}
```

**Define Multi-Tenant Schema**:

```typescript
// database/schema/tenants.ts (NEW FILE)
import { pgTable, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subdomain: text('subdomain').unique().notNull(),
  
  // White-label config
  config: jsonb('config').$type<{
    branding: {
      logo: string;
      primaryColor: string;
      companyName: string;
    };
    features: {
      agents: boolean;
      rag: boolean;
      lms: boolean;
      community: boolean;
    };
    limits: {
      maxUsers: number;
      maxAgents: number;
      maxStorage: number;
    };
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
```

```typescript
// database/schema/users.ts (UPDATE EXISTING)
import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ADD TENANT REFERENCE
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  email: text('email').notNull(),
  name: text('name'),
  tier: text('tier').$type<'free' | 'pro'>().default('free').notNull(),
  role: text('role').$type<'user' | 'admin'>().default('user').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Add unique constraint: email must be unique per tenant
export const emailTenantIndex = index('email_tenant_idx')
  .on(users.email, users.tenantId);
```

```typescript
// database/schema/conversations.ts (UPDATE EXISTING)
import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ADD TENANT REFERENCE
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
    
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
    
  title: text('title'),
  agentId: text('agent_id'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Run First Migration**:

```bash
# Generate migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push
```

#### Week 2: oRPC Integration

**Install oRPC**:

```bash
npm install @orpc/server @orpc/zod zod
```

**Create oRPC Generator**:

```typescript
// server/lib/orpc.ts (NEW FILE)
import { createRouter } from '@orpc/server';
import { z } from 'zod';
import type { Hono } from 'hono';

/**
 * Generates LLM-callable tools from Hono routes
 * 
 * Example:
 * app.post('/api/users/search', ...) 
 * → becomes tool: search_users
 */
export function generateToolsFromRoutes(
  app: Hono,
  options: {
    include?: string[];
    exclude?: string[];
    prefix?: string;
  } = {}
) {
  const routes = app.routes;
  const tools: any[] = [];
  
  for (const route of routes) {
    // Skip excluded patterns
    if (options.exclude?.some(pattern => 
      new RegExp(pattern).test(route.path)
    )) {
      continue;
    }
    
    // Only include specified patterns
    if (options.include && !options.include.some(pattern =>
      new RegExp(pattern).test(route.path)
    )) {
      continue;
    }
    
    // Extract schema from route validators
    const schema = extractZodSchema(route);
    if (!schema) continue;
    
    // Generate tool definition
    tools.push({
      name: routeToToolName(route.path),
      description: schema.description || `Call ${route.path}`,
      parameters: zodToJsonSchema(schema),
      execute: async (params: any) => {
        // Call the actual endpoint
        const response = await fetch(route.path, {
          method: route.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        return response.json();
      }
    });
  }
  
  return tools;
}

// Helper: Convert route path to tool name
// /api/users/search → search_users
function routeToToolName(path: string): string {
  return path
    .replace(/^\/api\//, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_');
}

// Helper: Extract Zod schema from route
function extractZodSchema(route: any) {
  // Implementation depends on how you attach validators
  // With @hono/zod-validator, schemas are attached to route metadata
  return route.schema;
}

// Helper: Convert Zod to JSON Schema
function zodToJsonSchema(schema: z.ZodType): any {
  // Use zod-to-json-schema library
  return schema;
}
```

**Use oRPC in Routes**:

```typescript
// server/routes/users.ts (EXAMPLE ROUTE)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '../lib/db';
import { users } from '@/database/schema';
import { ilike } from 'drizzle-orm';

const app = new Hono();

// Define schema with descriptions (for oRPC)
const searchSchema = z.object({
  query: z.string().describe('Search query for user name or email'),
  limit: z.number().optional().default(10).describe('Max results to return')
});

// This endpoint becomes an auto-generated tool!
app.post('/search',
  zValidator('json', searchSchema),
  async (c) => {
    const { query, limit } = c.req.valid('json');
    const tenantId = c.get('tenantId'); // From middleware
    
    const db = getDb();
    const results = await db.query.users.findMany({
      where: and(
        eq(users.tenantId, tenantId),
        or(
          ilike(users.name, `%${query}%`),
          ilike(users.email, `%${query}%`)
        )
      ),
      limit
    });
    
    return c.json({ users: results });
  }
);

export default app;
```

**Generate Tools in Chat Endpoint**:

```typescript
// server/routes/chat.ts
import { Hono } from 'hono';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateToolsFromRoutes } from '../lib/orpc';
import usersRoutes from './users';
import memoryRoutes from './memory';
import filesRoutes from './files';

const app = new Hono();

app.post('/v1/chat', async (c) => {
  const { messages, agentId } = await c.req.json();
  const tenantId = c.get('tenantId');
  
  // Load agent
  const db = getDb();
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, agentId),
      eq(agents.tenantId, tenantId)
    )
  });
  
  // Auto-generate tools from routes
  const allTools = generateToolsFromRoutes(app, {
    include: [
      '/api/users/.*',
      '/api/memory/.*',
      '/api/files/.*'
    ],
    exclude: ['/api/auth/.*']
  });
  
  // Filter to agent's allowed tools
  const agentTools = allTools.filter(t =>
    agent.tools.includes(t.name)
  );
  
  // Stream with auto-generated tools
  const result = streamText({
    model: openai(agent.model),
    messages,
    tools: agentTools,  // All auto-generated!
    system: agent.instructions
  });
  
  return result.toDataStreamResponse();
});

export default app;
```

**Test oRPC**:

```bash
# Start server
npm run dev

# Test tool generation
curl -X POST http://localhost:8787/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Search for users named John"}],
    "agentId": "agent_test"
  }'
```

---

### Phase 2: Core Features (Weeks 3-8)

#### Week 3-4: Multi-Tenancy

**Tenant Context Middleware**:

```typescript
// server/middleware/tenant.ts (NEW FILE)
import { createMiddleware } from 'hono/factory';
import { getDb } from '../lib/db';
import { tenants } from '@/database/schema';
import { eq } from 'drizzle-orm';

/**
 * Injects tenant context from subdomain
 * 
 * Example:
 * acme.solo-os.com → tenantId for 'acme'
 */
export const tenantMiddleware = createMiddleware(async (c, next) => {
  const host = c.req.header('host');
  
  if (!host) {
    return c.json({ error: 'No host header' }, 400);
  }
  
  // Extract subdomain
  // Format: subdomain.domain.com or localhost:8787
  const subdomain = host.split('.')[0];
  
  // Skip for localhost
  if (subdomain === 'localhost' || subdomain.includes(':')) {
    // Use default tenant for development
    c.set('tenantId', process.env.DEFAULT_TENANT_ID);
    c.set('subdomain', 'default');
    await next();
    return;
  }
  
  // Look up tenant
  const db = getDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.subdomain, subdomain)
  });
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  // Inject tenant context
  c.set('tenantId', tenant.id);
  c.set('tenant', tenant);
  
  await next();
});
```

**Apply to All Routes**:

```typescript
// server/index.ts
import { Hono } from 'hono';
import { tenantMiddleware } from './middleware/tenant';

const app = new Hono();

// Apply tenant middleware globally
app.use('*', tenantMiddleware);

// All routes now have access to:
// - c.get('tenantId')
// - c.get('tenant')

app.route('/api/users', usersRoutes);
app.route('/api/conversations', conversationsRoutes);
// ... etc
```

**Row-Level Security**:

```typescript
// All queries automatically filter by tenant

// BEFORE (no multi-tenancy)
const conversations = await db.query.conversations.findMany({
  where: eq(conversations.userId, userId)
});

// AFTER (with multi-tenancy)
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, tenantId),  // Always filter by tenant!
    eq(conversations.userId, userId)
  )
});
```

**Create Tenant Helper**:

```typescript
// server/lib/tenant-db.ts (NEW FILE)
import { getDb } from './db';
import type { Context } from 'hono';

/**
 * Returns a database instance that auto-filters by tenant
 */
export function getTenantDb(c: Context) {
  const tenantId = c.get('tenantId');
  const db = getDb();
  
  // Return wrapped db with tenant filtering
  return {
    ...db,
    
    // Override query methods to inject tenant filter
    query: new Proxy(db.query, {
      get(target, tableName: string) {
        const table = target[tableName];
        
        return {
          ...table,
          
          findMany: (config: any = {}) => {
            return table.findMany({
              ...config,
              where: and(
                eq(table.tenantId, tenantId),
                config.where
              )
            });
          },
          
          findFirst: (config: any = {}) => {
            return table.findFirst({
              ...config,
              where: and(
                eq(table.tenantId, tenantId),
                config.where
              )
            });
          }
        };
      }
    })
  };
}
```

**Usage**:

```typescript
// server/routes/conversations.ts
import { getTenantDb } from '../lib/tenant-db';

app.get('/list', async (c) => {
  const db = getTenantDb(c);  // Tenant-aware DB
  
  // Automatically filters by tenant!
  const conversations = await db.query.conversations.findMany({
    where: eq(conversations.userId, c.get('userId'))
  });
  
  return c.json({ conversations });
});
```

#### Week 5-6: Agent Migration

**Agent Schema**:

```typescript
// database/schema/agents.ts
import { pgTable, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),  // e.g., 'agent_abc123'
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  
  // Tool names (oRPC generated + Composio)
  tools: jsonb('tools').$type<string[]>().default([]),
  
  // Model parameters
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }>(),
  
  // Agent avatar/icon
  iconURL: text('icon_url'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Agent Execution Service**:

```typescript
// server/services/ai/agent-executor.ts (NEW FILE)
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateToolsFromRoutes } from '@/server/lib/orpc';
import { getComposioTools } from '../composio/integration';
import { injectMemory } from './memory-injection';

export async function executeAgent(
  agentId: string,
  messages: Message[],
  tenantId: string,
  userId: string
) {
  const db = getDb();
  
  // Load agent
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, agentId),
      eq(agents.tenantId, tenantId)
    )
  });
  
  if (!agent) {
    throw new Error('Agent not found');
  }
  
  // Generate oRPC tools
  const orpcTools = generateToolsFromRoutes(app, {
    include: ['/api/users/.*', '/api/memory/.*', '/api/files/.*']
  });
  
  // Get Composio tools
  const composioToolIds = agent.tools.filter(t =>
    t.startsWith('GITHUB_') || t.startsWith('GMAIL_')
  );
  const composioTools = await getComposioTools(userId, composioToolIds);
  
  // Filter to agent's allowed tools
  const allowedOrpcTools = orpcTools.filter(t =>
    agent.tools.includes(t.name)
  );
  
  // Combine all tools
  const allTools = [...allowedOrpcTools, ...composioTools];
  
  // Inject memory into system prompt
  const systemPrompt = await injectMemory(agent.instructions, userId, tenantId);
  
  // Select model provider
  const modelProvider = agent.provider === 'openai' ? openai : anthropic;
  
  // Stream response
  const result = streamText({
    model: modelProvider(agent.model),
    messages,
    tools: allTools,
    system: systemPrompt,
    temperature: agent.parameters?.temperature ?? 0.7,
    maxTokens: agent.parameters?.maxTokens ?? 4096
  });
  
  return result;
}
```

**Chat Endpoint**:

```typescript
// server/routes/chat.ts
import { executeAgent } from '../services/ai/agent-executor';

app.post('/v1/chat', async (c) => {
  const { messages, conversationId, agentId } = await c.req.json();
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  // Execute agent
  const result = await executeAgent(agentId, messages, tenantId, userId);
  
  // Save to database (background)
  c.executionCtx.waitUntil(
    saveConversationMessage(conversationId, messages, tenantId)
  );
  
  // Stream response
  return result.toDataStreamResponse();
});
```

#### Week 7-8: Memory System

**Memory Schema**:

```typescript
// database/schema/memories.ts
import { pgTable, text, uuid, timestamp, vector } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  content: text('content').notNull(),
  
  // Semantic search
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Memory type
  type: text('type').$type<'fact' | 'preference' | 'context'>().notNull(),
  
  // Metadata
  metadata: jsonb('metadata').$type<{
    source?: string;
    confidence?: number;
    category?: string;
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Vector index for similarity search
export const memoryEmbeddingIndex = index('memory_embedding_idx')
  .using('ivfflat', memories.embedding);
```

**Memory Service**:

```typescript
// server/services/ai/memory-injection.ts
import { getDb } from '@/server/lib/db';
import { memories } from '@/database/schema';
import { eq, sql, and } from 'drizzle-orm';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Injects relevant memories into agent system prompt
 */
export async function injectMemory(
  baseInstructions: string,
  userId: string,
  tenantId: string,
  limit: number = 10
): Promise<string> {
  const db = getDb();
  
  // Generate embedding for current instructions
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: baseInstructions
  });
  
  // Find similar memories
  const relevantMemories = await db.execute(sql`
    SELECT content, type, metadata
    FROM ${memories}
    WHERE ${and(
      eq(memories.tenantId, tenantId),
      eq(memories.userId, userId)
    )}
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `);
  
  if (relevantMemories.length === 0) {
    return baseInstructions;
  }
  
  // Format memories
  const memoryContext = relevantMemories
    .map(m => `- ${m.content}`)
    .join('\n');
  
  // Inject into prompt
  return `${baseInstructions}

## User Context & Memories

The following is relevant context about this user:

${memoryContext}

Use this information to personalize your responses, but don't explicitly mention "I remember" unless contextually appropriate.`;
}
```

**Add Memory Endpoint**:

```typescript
// server/routes/memory.ts
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const app = new Hono();

app.post('/add',
  zValidator('json', z.object({
    content: z.string().describe('Memory content to store'),
    type: z.enum(['fact', 'preference', 'context']).describe('Type of memory')
  })),
  async (c) => {
    const { content, type } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    
    // Generate embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: content
    });
    
    // Save to database
    const db = getDb();
    const [memory] = await db.insert(memories).values({
      tenantId,
      userId,
      content,
      type,
      embedding
    }).returning();
    
    return c.json({ memory });
  }
);

export default app;
```

---

### Phase 3: Advanced Features (Weeks 9-12)

#### Week 9-10: RAG with pgvector

**Document Chunks Schema**:

```typescript
// database/schema/document-chunks.ts
import { pgTable, text, uuid, timestamp, vector, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { files } from './files';

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  fileId: uuid('file_id')
    .references(() => files.id, { onDelete: 'cascade' })
    .notNull(),
  
  content: text('content').notNull(),
  
  // pgvector for semantic search
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Chunk metadata
  chunkIndex: integer('chunk_index').notNull(),
  startPage: integer('start_page'),
  endPage: integer('end_page'),
  
  metadata: jsonb('metadata').$type<{
    tokens?: number;
    headings?: string[];
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const embeddingIndex = index('document_chunks_embedding_idx')
  .using('ivfflat', documentChunks.embedding);

export const fileIdIndex = index('document_chunks_file_id_idx')
  .on(documentChunks.fileId);
```

**File Upload & Chunking**:

```typescript
// server/routes/files.ts
import { put } from '@vercel/blob';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

app.post('/upload',
  async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    
    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true
    });
    
    // Save file metadata
    const db = getDb();
    const [fileRecord] = await db.insert(files).values({
      tenantId,
      userId,
      name: file.name,
      url: blob.url,
      mimeType: file.type,
      size: file.size
    }).returning();
    
    // Process in background
    c.executionCtx.waitUntil(
      processFileForRAG(fileRecord.id, blob.url, tenantId)
    );
    
    return c.json({ file: fileRecord });
  }
);

/**
 * Process file: chunk → embed → store
 */
async function processFileForRAG(
  fileId: string,
  fileUrl: string,
  tenantId: string
) {
  // Load PDF
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  const loader = new PDFLoader(new Blob([buffer]));
  const docs = await loader.load();
  
  // Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  const chunks = await splitter.splitDocuments(docs);
  
  // Generate embeddings for all chunks
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map(c => c.pageContent)
  });
  
  // Save to database
  const db = getDb();
  await db.insert(documentChunks).values(
    chunks.map((chunk, i) => ({
      tenantId,
      fileId,
      content: chunk.pageContent,
      embedding: embeddings[i],
      chunkIndex: i,
      startPage: chunk.metadata.loc?.pageNumber,
      metadata: { tokens: chunk.pageContent.length / 4 }
    }))
  );
}
```

**File Search Tool** (auto-exposed via oRPC):

```typescript
// server/routes/files.ts
app.post('/search',
  zValidator('json', z.object({
    query: z.string().describe('Search query'),
    fileIds: z.array(z.string()).optional().describe('Filter by file IDs'),
    limit: z.number().optional().default(5).describe('Max results')
  })),
  async (c) => {
    const { query, fileIds, limit } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    
    // Generate query embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query
    });
    
    // Search with pgvector
    const db = getDb();
    const results = await db.execute(sql`
      SELECT 
        dc.content,
        dc.metadata,
        dc.start_page,
        f.name as file_name,
        (dc.embedding <=> ${embedding}::vector) as distance
      FROM ${documentChunks} dc
      JOIN ${files} f ON dc.file_id = f.id
      WHERE dc.tenant_id = ${tenantId}
        ${fileIds ? sql`AND dc.file_id = ANY(${fileIds})` : sql``}
      ORDER BY distance ASC
      LIMIT ${limit}
    `);
    
    return c.json({ results });
  }
);
```

**Agent now automatically has `file_search` tool via oRPC!**

#### Week 11-12: LMS Features

**Course Schema**:

```typescript
// database/schema/courses.ts
import { pgTable, text, uuid, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  
  title: text('title').notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  
  // Module structure
  modules: jsonb('modules').$type<Array<{
    id: string;
    title: string;
    description: string;
    videoUrl?: string;
    recordingId?: string;  // Link to Stream recording
    duration?: number;
    order: number;
  }>>().default([]),
  
  // Access control
  tier: text('tier').$type<'free' | 'pro'>().default('free'),
  
  published: boolean('published').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User progress
export const courseProgress = pgTable('course_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  
  completedModules: jsonb('completed_modules').$type<string[]>().default([]),
  lastAccessedModule: text('last_accessed_module'),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Keep Stream Video Integration**:

```typescript
// ShadFlareAi already has good examples - keep as-is
// Just add tenant filtering

// server/routes/video.ts
app.post('/create-meeting', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  // Create Stream call (existing code from ShadFlareAi)
  const call = streamClient.video.call('default', callId);
  await call.getOrCreate({
    data: {
      members: [{ user_id: userId }],
      custom: { tenantId }  // Add tenant metadata
    }
  });
  
  return c.json({ call });
});
```

**CometChat Integration**:

```typescript
// Keep existing CometChat SDK on frontend
// Just add tenant-specific group IDs

// src/lib/cometchat.ts
export async function initializeCometChat(tenantId: string, userId: string) {
  await CometChat.init(COMETCHAT_APP_ID);
  
  const user = await CometChat.login(userId, COMETCHAT_AUTH_KEY);
  
  // Join tenant-specific group
  const groupId = `${tenantId}_community`;
  await CometChat.joinGroup(groupId, CometChat.GROUP_TYPE.PUBLIC);
  
  return user;
}
```

---

### Phase 4: Polish & Deploy (Weeks 13-16)

#### Week 13: Composio Integration

**Setup Composio**:

```bash
npm install composio-core
```

**Integration Service**:

```typescript
// server/services/composio/integration.ts
import { Composio } from 'composio-core';

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY
});

/**
 * Get Composio tools for a user
 * Tools: GitHub, Gmail, Calendar, Notion, Slack, etc.
 */
export async function getComposioTools(
  userId: string,
  toolIds: string[]
) {
  const tools = await composio.getToolsForUser({
    userId,
    tools: toolIds
  });
  
  // Convert to Vercel AI SDK format
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (params: any) => {
      return await composio.execute({
        userId,
        toolName: tool.name,
        params
      });
    }
  }));
}

/**
 * Available tools
 */
export const COMPOSIO_TOOLS = {
  // GitHub
  GITHUB_GET_REPO: 'Get repository info',
  GITHUB_CREATE_ISSUE: 'Create GitHub issue',
  GITHUB_CREATE_PR: 'Create pull request',
  
  // Gmail
  GMAIL_SEND: 'Send email',
  GMAIL_SEARCH: 'Search emails',
  
  // Calendar
  GCAL_CREATE_EVENT: 'Create calendar event',
  GCAL_LIST_EVENTS: 'List calendar events',
  
  // Notion
  NOTION_CREATE_PAGE: 'Create Notion page',
  NOTION_SEARCH: 'Search Notion',
  
  // Slack
  SLACK_SEND_MESSAGE: 'Send Slack message',
  SLACK_CREATE_CHANNEL: 'Create Slack channel'
};
```

**Agent UI - Tool Selection**:

```tsx
// src/components/agents/agent-builder.tsx
import { COMPOSIO_TOOLS } from '@/server/services/composio/integration';

export function AgentBuilder() {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  
  return (
    <div>
      <h3>Available Tools</h3>
      
      {/* oRPC Tools (auto-generated from your API) */}
      <div>
        <h4>Internal Tools</h4>
        {autoGeneratedTools.map(tool => (
          <Checkbox
            key={tool.name}
            label={tool.description}
            checked={selectedTools.includes(tool.name)}
            onChange={(checked) => {
              if (checked) {
                setSelectedTools([...selectedTools, tool.name]);
              }
            }}
          />
        ))}
      </div>
      
      {/* Composio Tools */}
      <div>
        <h4>External Integrations</h4>
        {Object.entries(COMPOSIO_TOOLS).map(([id, desc]) => (
          <Checkbox
            key={id}
            label={`${id}: ${desc}`}
            checked={selectedTools.includes(id)}
            onChange={(checked) => {
              if (checked) {
                setSelectedTools([...selectedTools, id]);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

#### Week 14-15: Data Migration

**MongoDB to Neon Migration Script**:

```typescript
// scripts/migrate-from-mongodb.ts
import { MongoClient } from 'mongodb';
import { getDb } from '@/server/lib/db';
import { users, conversations, messages, agents } from '@/database/schema';

async function migrate() {
  // Connect to MongoDB
  const mongo = new MongoClient(process.env.MONGODB_URI!);
  await mongo.connect();
  const oldDb = mongo.db();
  
  // Connect to Neon
  const newDb = getDb();
  
  // Create default tenant
  const [tenant] = await newDb.insert(tenants).values({
    name: 'Solo OS',
    subdomain: 'default',
    config: {
      branding: {
        logo: '/logo.png',
        primaryColor: '#000000',
        companyName: 'Solo OS'
      },
      features: {
        agents: true,
        rag: true,
        lms: true,
        community: true
      },
      limits: {
        maxUsers: 10000,
        maxAgents: 100,
        maxStorage: 100 * 1024 * 1024 * 1024 // 100GB
      }
    }
  }).returning();
  
  console.log('Created tenant:', tenant.id);
  
  // Migrate users
  console.log('Migrating users...');
  const mongoUsers = await oldDb.collection('users').find().toArray();
  
  for (const user of mongoUsers) {
    await newDb.insert(users).values({
      id: user._id.toString(),
      tenantId: tenant.id,
      email: user.email,
      name: user.name,
      tier: user.tier || 'free',
      role: user.role || 'user'
    });
  }
  
  console.log(`Migrated ${mongoUsers.length} users`);
  
  // Migrate conversations
  console.log('Migrating conversations...');
  const mongoConvos = await oldDb.collection('conversations').find().toArray();
  
  for (const convo of mongoConvos) {
    await newDb.insert(conversations).values({
      id: convo._id.toString(),
      tenantId: tenant.id,
      userId: convo.user.toString(),
      title: convo.title,
      agentId: convo.agentId,
      createdAt: convo.createdAt
    });
  }
  
  console.log(`Migrated ${mongoConvos.length} conversations`);
  
  // Migrate messages
  console.log('Migrating messages...');
  const mongoMessages = await oldDb.collection('messages').find().toArray();
  
  for (const msg of mongoMessages) {
    await newDb.insert(messages).values({
      id: msg._id.toString(),
      tenantId: tenant.id,
      conversationId: msg.conversationId,
      content: msg.text,
      role: msg.isCreatedByUser ? 'user' : 'assistant',
      parentId: msg.parentMessageId,
      createdAt: msg.createdAt
    });
  }
  
  console.log(`Migrated ${mongoMessages.length} messages`);
  
  // Migrate agents
  console.log('Migrating agents...');
  const mongoAgents = await oldDb.collection('agents').find().toArray();
  
  for (const agent of mongoAgents) {
    await newDb.insert(agents).values({
      id: agent.id,
      tenantId: tenant.id,
      name: agent.name,
      instructions: agent.instructions,
      model: agent.model,
      provider: agent.provider,
      tools: agent.tools,
      parameters: agent.model_parameters,
      iconURL: agent.iconURL
    });
  }
  
  console.log(`Migrated ${mongoAgents.length} agents`);
  
  await mongo.close();
  console.log('Migration complete!');
}

migrate();
```

**Run Migration**:

```bash
# Set environment variables
export MONGODB_URI="mongodb://..."
export DATABASE_URL="postgresql://..."

# Run migration
tsx scripts/migrate-from-mongodb.ts
```

#### Week 16: Deploy

**Cloudflare Workers Deployment**:

```bash
# Update wrangler.toml
npm install -g wrangler

# Deploy
npm run deploy
```

```toml
# wrangler.toml
name = "solo-os-api"
main = "server/index.ts"
compatibility_date = "2024-01-01"

[vars]
DATABASE_URL = "postgresql://..."
COMPOSIO_API_KEY = "..."
OPENAI_API_KEY = "..."

[build]
command = "npm run build"
```

**Vercel Frontend Deployment**:

```bash
# Deploy to Vercel
vercel --prod
```

**Environment Variables**:

```bash
# .env.production
DATABASE_URL=postgresql://...
COMPOSIO_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
VERCEL_BLOB_READ_WRITE_TOKEN=...
STREAM_API_KEY=...
COMETCHAT_APP_ID=...
```

---

## Cost Breakdown

### Development (4 months)

| Role | Cost |
|------|------|
| Senior Full-Stack Dev | $100K |
| Mid-Level Dev | $50K |
| **Total** | **$150K** |

### Monthly Infra (Production)

| Service | Cost | Notes |
|---------|------|-------|
| Neon Postgres | $69 | Scale plan |
| Vercel Pro | $20 | Hosting + Blob |
| Cloudflare Workers | $5 | 10M requests |
| OpenAI API | Variable | Based on usage |
| Anthropic API | Variable | Based on usage |
| Composio | $99 | Business plan |
| Stream Video | Variable | Based on usage |
| CometChat | Variable | Based on usage |
| **Total Base** | **~$200/mo** | + usage-based |

---

## Success Metrics

- **Week 2**: Basic chat working with oRPC tools
- **Week 4**: Multi-tenancy functional
- **Week 8**: Agents + Memory working
- **Week 12**: RAG + LMS functional
- **Week 16**: Production deployment

---

## Next Actions

1. **Fork ShadFlareAi**: https://github.com/codevibesmatter/ShadFlareAi
2. **Setup Neon**: https://neon.tech
3. **Start Week 1**: Follow this guide step-by-step
4. **Join oRPC Discord**: Get help with tool generation
5. **Test POC**: Build one agent end-to-end in Week 2

**This is your accelerated path to production. Let's ship! 🚀**
