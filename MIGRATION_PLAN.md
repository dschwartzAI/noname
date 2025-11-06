# Migration Plan: ShadFlareAi → Solo OS

## Overview

Migrate from Cloudflare D1 to Neon Postgres while adding multi-tenancy, oRPC tool generation, and Composio integrations.

**Focus**: AI Agent Platform (no video/chat features)  
**Timeline**: 16 weeks  
**Status**: Week 0 - Planning & Setup

---

## Technology Stack

### Current (ShadFlareAi)
- Database: Cloudflare D1 (SQLite)
- Backend: Cloudflare Workers + Hono
- Auth: Better Auth
- AI: Vercel AI SDK
- Storage: Cloudflare R2, KV

### Target (Solo OS)
- Database: Neon Postgres (with pgvector)
- Backend: Cloudflare Workers + Hono ✅
- Auth: Better Auth ✅
- AI: Vercel AI SDK ✅
- Multi-tenancy: Row-level security
- Tool Generation: oRPC (auto-generate from API)
- Integrations: Composio (GitHub, Gmail, Slack, etc.)
- Storage: Vercel Blob
- **REMOVED**: Stream video, CometChat

---

## Phase 1: Database Migration (Weeks 1-2)

### Week 1: Neon Setup

#### Step 1: Create Neon Project

```bash
# 1. Sign up at https://neon.tech
# 2. Create new project: "solo-os"
# 3. Get connection string
```

#### Step 2: Install Dependencies

```bash
npm install @neondatabase/serverless drizzle-orm@latest
npm install -D drizzle-kit@latest
npm install @vercel/blob  # For file storage
```

#### Step 3: Update Database Configuration

```typescript
// database/neon-db.ts (NEW)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export function getNeonDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}
```

#### Step 4: Add Multi-Tenancy Schema

```typescript
// database/schema/tenants.ts (NEW)
import { pgTable, text, uuid, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subdomain: text('subdomain').unique().notNull(),
  
  // White-label configuration
  config: jsonb('config').$type<{
    branding: {
      logo: string;
      primaryColor: string;
      companyName: string;
    };
    features: {
      agents: boolean;
      rag: boolean;
      memory: boolean;
      composio: boolean;
    };
    limits: {
      maxUsers: number;
      maxAgents: number;
      maxStorage: number;
      maxApiCalls: number;
    };
  }>(),
  
  // Subscription
  tier: text('tier').$type<'free' | 'pro' | 'enterprise'>().default('free').notNull(),
  active: boolean('active').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### Step 5: Update Existing Schemas with Tenant References

```typescript
// database/schema/users.ts (UPDATE)
import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ADD TENANT REFERENCE
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  email: text('email').notNull(),
  name: text('name'),
  emailVerified: timestamp('email_verified'),
  image: text('image'),
  
  role: text('role').$type<'user' | 'admin' | 'owner'>().default('user').notNull(),
  tier: text('tier').$type<'free' | 'pro'>().default('free').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Email must be unique per tenant
  emailTenantIdx: index('email_tenant_idx').on(table.email, table.tenantId),
}));
```

```typescript
// database/schema/conversations.ts (UPDATE)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ADD TENANT REFERENCE
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  title: text('title'),
  agentId: text('agent_id'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('conversations_tenant_idx').on(table.tenantId),
  userIdx: index('conversations_user_idx').on(table.userId),
}));
```

#### Step 6: Generate and Apply Migrations

```bash
# Generate migration
npx drizzle-kit generate

# Review migrations in drizzle/migrations/

# Apply to Neon
npx drizzle-kit push
```

### Week 2: oRPC Integration

#### Step 1: Install oRPC

```bash
npm install @orpc/server @orpc/zod zod-to-json-schema
```

#### Step 2: Create oRPC Tool Generator

```typescript
// server/lib/orpc-generator.ts (NEW)
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Hono } from 'hono';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}

/**
 * Auto-generates LLM-callable tools from Hono API routes
 * 
 * Routes with Zod validators become tools automatically!
 * 
 * Example: POST /api/users/search → tool: search_users
 */
export function generateToolsFromRoutes(
  routes: RouteConfig[],
  options: {
    include?: string[];
    exclude?: string[];
    baseUrl?: string;
  } = {}
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  for (const route of routes) {
    // Skip excluded patterns (auth, internal, etc.)
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
    
    // Must have Zod schema
    if (!route.schema) continue;
    
    // Generate tool definition
    tools.push({
      name: routeToToolName(route.path, route.method),
      description: route.schema.description || `Call ${route.path}`,
      parameters: zodToJsonSchema(route.schema),
      execute: createToolExecutor(route, options.baseUrl)
    });
  }
  
  return tools;
}

// Convert /api/users/search → search_users
function routeToToolName(path: string, method: string): string {
  return path
    .replace(/^\/api\//, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_')
    .replace(/:/g, '')
    .toLowerCase();
}

// Create executor that calls the actual endpoint
function createToolExecutor(route: RouteConfig, baseUrl: string = '') {
  return async (params: any) => {
    const url = `${baseUrl}${route.path}`;
    const response = await fetch(url, {
      method: route.method,
      headers: { 
        'Content-Type': 'application/json',
        // Include auth headers if needed
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`);
    }
    
    return await response.json();
  };
}

interface RouteConfig {
  path: string;
  method: string;
  schema?: z.ZodType;
}
```

#### Step 3: Register Routes for Tool Generation

```typescript
// server/lib/tool-routes.ts (NEW)
import { z } from 'zod';

/**
 * Central registry of routes that should be exposed as tools
 * Add descriptions to help the AI understand when to use each tool
 */
export const TOOL_ROUTES = [
  {
    path: '/api/users/search',
    method: 'POST',
    schema: z.object({
      query: z.string().describe('Search query for user name or email'),
      limit: z.number().optional().default(10).describe('Max results to return')
    }).describe('Search for users by name or email')
  },
  {
    path: '/api/memory/add',
    method: 'POST',
    schema: z.object({
      content: z.string().describe('Memory content to store'),
      type: z.enum(['fact', 'preference', 'context']).describe('Type of memory')
    }).describe('Store a memory about the user')
  },
  {
    path: '/api/memory/search',
    method: 'POST',
    schema: z.object({
      query: z.string().describe('Search query for memories'),
      limit: z.number().optional().default(10)
    }).describe('Search user memories semantically')
  },
  {
    path: '/api/files/search',
    method: 'POST',
    schema: z.object({
      query: z.string().describe('Search query for document content'),
      fileIds: z.array(z.string()).optional().describe('Filter by file IDs'),
      limit: z.number().optional().default(5)
    }).describe('Search uploaded documents using RAG')
  },
  {
    path: '/api/files/upload',
    method: 'POST',
    schema: z.object({
      url: z.string().describe('URL of file to upload'),
      name: z.string().describe('File name')
    }).describe('Upload a file for RAG processing')
  }
];
```

#### Step 4: Update Chat Endpoint with Auto-Generated Tools

```typescript
// functions/api/chat.ts (UPDATE)
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateToolsFromRoutes } from '@/server/lib/orpc-generator';
import { TOOL_ROUTES } from '@/server/lib/tool-routes';
import { getComposioTools } from '@/server/services/composio/integration';

app.post('/v1/chat', async (c) => {
  const { messages, agentId } = await c.req.json();
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  // Load agent configuration
  const db = getNeonDb();
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, agentId),
      eq(agents.tenantId, tenantId)
    )
  });
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Auto-generate tools from API routes
  const orpcTools = generateToolsFromRoutes(TOOL_ROUTES, {
    baseUrl: c.req.url.replace(/\/v1\/chat$/, '')
  });
  
  // Get Composio tools
  const composioToolIds = agent.tools.filter(t =>
    t.startsWith('GITHUB_') || 
    t.startsWith('GMAIL_') ||
    t.startsWith('SLACK_')
  );
  const composioTools = await getComposioTools(userId, composioToolIds);
  
  // Filter to agent's allowed tools
  const allowedOrpcTools = orpcTools.filter(t =>
    agent.tools.includes(t.name)
  );
  
  // Combine all tools
  const allTools = [...allowedOrpcTools, ...composioTools];
  
  // Stream response
  const result = streamText({
    model: openai(agent.model),
    messages,
    tools: allTools,
    system: agent.instructions,
    temperature: agent.parameters?.temperature ?? 0.7
  });
  
  return result.toDataStreamResponse();
});
```

---

## Phase 2: Multi-Tenancy (Weeks 3-4)

### Tenant Middleware

```typescript
// server/middleware/tenant.ts (NEW)
import { createMiddleware } from 'hono/factory';
import { getNeonDb } from '@/database/neon-db';
import { tenants } from '@/database/schema';
import { eq } from 'drizzle-orm';

export const tenantMiddleware = createMiddleware(async (c, next) => {
  const host = c.req.header('host') || '';
  
  // Extract subdomain
  // Format: subdomain.domain.com or localhost:5174
  const parts = host.split('.');
  const subdomain = parts.length > 2 ? parts[0] : 'default';
  
  // Skip for localhost
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    c.set('tenantId', process.env.DEFAULT_TENANT_ID || 'default');
    c.set('subdomain', 'default');
    await next();
    return;
  }
  
  // Lookup tenant
  const db = getNeonDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.subdomain, subdomain)
  });
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  if (!tenant.active) {
    return c.json({ error: 'Tenant inactive' }, 403);
  }
  
  // Inject tenant context
  c.set('tenantId', tenant.id);
  c.set('tenant', tenant);
  c.set('subdomain', subdomain);
  
  await next();
});
```

### Tenant-Aware Database Helper

```typescript
// server/lib/tenant-db.ts (NEW)
import { getNeonDb } from '@/database/neon-db';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';

/**
 * Returns database with automatic tenant filtering
 * 
 * Usage:
 *   const db = getTenantDb(c);
 *   const users = await db.query.users.findMany(); // Auto-filters by tenantId!
 */
export function getTenantDb(c: Context) {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new Error('Tenant context not found');
  }
  
  const db = getNeonDb();
  
  // Return wrapped DB with tenant filtering
  return {
    ...db,
    query: createTenantProxy(db.query, tenantId)
  };
}

function createTenantProxy(query: any, tenantId: string) {
  return new Proxy(query, {
    get(target, tableName: string) {
      const table = target[tableName];
      
      return {
        ...table,
        
        findMany: (config: any = {}) => {
          return table.findMany({
            ...config,
            where: config.where 
              ? and(eq(table.tenantId, tenantId), config.where)
              : eq(table.tenantId, tenantId)
          });
        },
        
        findFirst: (config: any = {}) => {
          return table.findFirst({
            ...config,
            where: config.where
              ? and(eq(table.tenantId, tenantId), config.where)
              : eq(table.tenantId, tenantId)
          });
        }
      };
    }
  });
}
```

### Apply Middleware Globally

```typescript
// worker.ts or server/index.ts (UPDATE)
import { Hono } from 'hono';
import { tenantMiddleware } from './server/middleware/tenant';

const app = new Hono();

// Apply tenant middleware to all routes
app.use('*', tenantMiddleware);

// All subsequent routes have access to:
// - c.get('tenantId')
// - c.get('tenant')
// - c.get('subdomain')

app.route('/api', apiRoutes);
```

---

## Phase 3: Core Features (Weeks 5-10)

### Week 5-6: Agent System

**Agent Schema:**

```typescript
// database/schema/agents.ts (NEW)
import { pgTable, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // e.g., 'agent_abc123'
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  
  // Model configuration
  model: text('model').notNull(), // e.g., 'gpt-4'
  provider: text('provider').notNull(), // 'openai' | 'anthropic'
  
  // Tool names (oRPC + Composio)
  tools: jsonb('tools').$type<string[]>().default([]),
  
  // Model parameters
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }>(),
  
  // UI
  iconURL: text('icon_url'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Week 7-8: Memory System with pgvector

**Enable pgvector in Neon:**

```sql
-- Run this in Neon SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

**Memory Schema:**

```typescript
// database/schema/memories.ts (NEW)
import { pgTable, text, uuid, timestamp, jsonb, index, sql } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  content: text('content').notNull(),
  
  // pgvector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding: sql`vector(1536)`,
  
  type: text('type').$type<'fact' | 'preference' | 'context'>().notNull(),
  
  metadata: jsonb('metadata').$type<{
    source?: string;
    confidence?: number;
    category?: string;
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Vector similarity index
  embeddingIdx: index('memories_embedding_idx').using('ivfflat', sql`${table.embedding} vector_cosine_ops`),
  tenantIdx: index('memories_tenant_idx').on(table.tenantId),
  userIdx: index('memories_user_idx').on(table.userId),
}));
```

**Memory Service:**

```typescript
// server/services/memory/memory-service.ts (NEW)
import { getNeonDb } from '@/database/neon-db';
import { memories } from '@/database/schema';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { eq, sql, and } from 'drizzle-orm';

export async function addMemory(
  content: string,
  type: 'fact' | 'preference' | 'context',
  userId: string,
  tenantId: string
) {
  // Generate embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: content
  });
  
  // Save to database
  const db = getNeonDb();
  const [memory] = await db.insert(memories).values({
    tenantId,
    userId,
    content,
    type,
    embedding: sql`${JSON.stringify(embedding)}::vector`
  }).returning();
  
  return memory;
}

export async function searchMemories(
  query: string,
  userId: string,
  tenantId: string,
  limit: number = 10
) {
  // Generate query embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query
  });
  
  // Semantic search with cosine similarity
  const db = getNeonDb();
  const results = await db.execute(sql`
    SELECT 
      id,
      content,
      type,
      metadata,
      (embedding <=> ${JSON.stringify(embedding)}::vector) as distance
    FROM ${memories}
    WHERE 
      tenant_id = ${tenantId}
      AND user_id = ${userId}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);
  
  return results.rows;
}
```

### Week 9-10: RAG with pgvector

**Document Chunks Schema:**

```typescript
// database/schema/document-chunks.ts (NEW)
import { pgTable, text, uuid, timestamp, integer, jsonb, index, sql } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').notNull(),
  
  name: text('name').notNull(),
  url: text('url').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  
  status: text('status').$type<'processing' | 'ready' | 'failed'>().default('processing'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  fileId: uuid('file_id')
    .references(() => files.id, { onDelete: 'cascade' })
    .notNull(),
  
  content: text('content').notNull(),
  
  // pgvector embedding
  embedding: sql`vector(1536)`,
  
  // Chunk metadata
  chunkIndex: integer('chunk_index').notNull(),
  startPage: integer('start_page'),
  endPage: integer('end_page'),
  
  metadata: jsonb('metadata').$type<{
    tokens?: number;
    headings?: string[];
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  embeddingIdx: index('doc_chunks_embedding_idx').using('ivfflat', sql`${table.embedding} vector_cosine_ops`),
  fileIdx: index('doc_chunks_file_idx').on(table.fileId),
}));
```

**File Upload & Processing:**

```typescript
// server/services/rag/file-processor.ts (NEW)
import { put } from '@vercel/blob';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getNeonDb } from '@/database/neon-db';
import { files, documentChunks } from '@/database/schema';

export async function uploadAndProcessFile(
  file: File,
  userId: string,
  tenantId: string
) {
  const db = getNeonDb();
  
  // Upload to Vercel Blob
  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true
  });
  
  // Save file metadata
  const [fileRecord] = await db.insert(files).values({
    tenantId,
    userId,
    name: file.name,
    url: blob.url,
    mimeType: file.type,
    size: file.size,
    status: 'processing'
  }).returning();
  
  // Process in background
  processFileForRAG(fileRecord.id, blob.url, tenantId).catch(console.error);
  
  return fileRecord;
}

async function processFileForRAG(
  fileId: string,
  fileUrl: string,
  tenantId: string
) {
  const db = getNeonDb();
  
  try {
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
    
    // Generate embeddings
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks.map(c => c.pageContent)
    });
    
    // Save chunks
    await db.insert(documentChunks).values(
      chunks.map((chunk, i) => ({
        tenantId,
        fileId,
        content: chunk.pageContent,
        embedding: sql`${JSON.stringify(embeddings[i])}::vector`,
        chunkIndex: i,
        startPage: chunk.metadata.loc?.pageNumber,
        metadata: { tokens: Math.ceil(chunk.pageContent.length / 4) }
      }))
    );
    
    // Update file status
    await db.update(files)
      .set({ status: 'ready' })
      .where(eq(files.id, fileId));
      
  } catch (error) {
    // Mark as failed
    await db.update(files)
      .set({ status: 'failed' })
      .where(eq(files.id, fileId));
    throw error;
  }
}

export async function searchDocuments(
  query: string,
  tenantId: string,
  fileIds?: string[],
  limit: number = 5
) {
  // Generate query embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query
  });
  
  // Search with pgvector
  const db = getNeonDb();
  const results = await db.execute(sql`
    SELECT 
      dc.content,
      dc.metadata,
      dc.start_page,
      f.name as file_name,
      f.url as file_url,
      (dc.embedding <=> ${JSON.stringify(embedding)}::vector) as distance
    FROM ${documentChunks} dc
    JOIN ${files} f ON dc.file_id = f.id
    WHERE dc.tenant_id = ${tenantId}
      AND f.status = 'ready'
      ${fileIds ? sql`AND dc.file_id = ANY(${fileIds})` : sql``}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);
  
  return results.rows;
}
```

---

## Phase 4: Composio Integration (Week 11)

```bash
npm install composio-core
```

```typescript
// server/services/composio/integration.ts (NEW)
import { Composio } from 'composio-core';

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY
});

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

// Available Composio tools
export const COMPOSIO_TOOLS = {
  // GitHub
  GITHUB_CREATE_ISSUE: 'Create GitHub issue',
  GITHUB_CREATE_PR: 'Create pull request',
  GITHUB_SEARCH_CODE: 'Search code in repositories',
  
  // Gmail
  GMAIL_SEND: 'Send email',
  GMAIL_SEARCH: 'Search emails',
  
  // Google Calendar
  GCAL_CREATE_EVENT: 'Create calendar event',
  GCAL_LIST_EVENTS: 'List upcoming events',
  
  // Slack
  SLACK_SEND_MESSAGE: 'Send Slack message',
  SLACK_CREATE_CHANNEL: 'Create Slack channel',
  
  // Notion
  NOTION_CREATE_PAGE: 'Create Notion page',
  NOTION_SEARCH: 'Search Notion workspace',
};
```

---

## Phase 5: Admin & Polish (Weeks 12-13)

### Admin Dashboard
- Tenant management UI
- Usage analytics
- User management
- Subscription/billing integration

### API Documentation
- Update OpenAPI specs
- Document all oRPC-generated tools
- Create integration guides

---

## Phase 6: Data Migration (Week 14-15)

```typescript
// scripts/migrate-d1-to-neon.ts (NEW)
import { getNeonDb } from '@/database/neon-db';
import { tenants, users, conversations, messages } from '@/database/schema';

async function migrateFromD1() {
  const db = getNeonDb();
  
  // 1. Create default tenant
  const [tenant] = await db.insert(tenants).values({
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
        memory: true,
        composio: true
      },
      limits: {
        maxUsers: 10000,
        maxAgents: 100,
        maxStorage: 100 * 1024 * 1024 * 1024,
        maxApiCalls: 1000000
      }
    },
    tier: 'enterprise'
  }).returning();
  
  console.log('Created tenant:', tenant.id);
  
  // 2. Export data from D1
  // 3. Transform and import to Neon
  // 4. Verify data integrity
  
  console.log('Migration complete!');
}
```

---

## Phase 7: Deploy (Week 16)

### Environment Variables

```bash
# .env.production
DATABASE_URL=postgresql://neon-connection-string
COMPOSIO_API_KEY=your-composio-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
VERCEL_BLOB_READ_WRITE_TOKEN=your-blob-token
DEFAULT_TENANT_ID=default-tenant-uuid
```

### Deploy

```bash
# Build
npm run build

# Deploy Workers
wrangler deploy

# Deploy Frontend
vercel --prod
```

---

## Files to Create

### New Files
- `database/neon-db.ts`
- `database/schema/tenants.ts`
- `database/schema/agents.ts`
- `database/schema/memories.ts`
- `database/schema/document-chunks.ts`
- `server/lib/orpc-generator.ts`
- `server/lib/tool-routes.ts`
- `server/lib/tenant-db.ts`
- `server/middleware/tenant.ts`
- `server/services/composio/integration.ts`
- `server/services/memory/memory-service.ts`
- `server/services/rag/file-processor.ts`
- `scripts/migrate-d1-to-neon.ts`

### Update Files
- `database/db.ts` → switch to Neon
- `database/schema/*.ts` → add tenantId
- `worker.ts` → add tenant middleware
- `functions/api/**/*.ts` → use getTenantDb()
- `wrangler.toml` → update env vars

### Remove Files (Video/Chat Features)
- Any Stream video integrations
- Any CometChat integrations
- LMS/course-related files

---

## Cost Breakdown

### Development (16 weeks)
- Senior Full-Stack Dev: $100K
- Mid-Level Dev: $50K
- **Total: $150K**

### Monthly Infrastructure
- Neon Postgres: $69 (Scale plan)
- Vercel Pro: $20
- Cloudflare Workers: $5
- Composio: $99
- OpenAI API: Variable
- **Base Total: ~$200/mo + usage**

---

## Success Metrics

- ✅ Week 2: Chat with oRPC tools working
- ✅ Week 4: Multi-tenancy functional
- ✅ Week 8: Agents + Memory working
- ✅ Week 10: RAG functional
- ✅ Week 13: Admin dashboard complete
- ✅ Week 16: Production deployment

---

## Next Actions

1. ✅ **Create Neon account**: https://neon.tech
2. ⬜ **Get Composio API key**: https://composio.dev
3. ⬜ **Get Vercel Blob token**: https://vercel.com/dashboard
4. ⬜ **Start Week 1**: Follow Phase 1 above
5. ⬜ **Test incrementally**: Don't break existing UI

---

**Focus**: AI Agent Platform with multi-tenancy, no video/chat features
**Leverage**: Keep ShadFlareAi's excellent UI/UX and existing AI infrastructure
**Add**: Neon, multi-tenancy, oRPC, Composio, pgvector

Let's build! 🚀
