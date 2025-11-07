# Chat System Schemas

This document describes the Drizzle ORM schemas for the AI chat system, including conversations, messages, and agents.

## Overview

The chat system consists of three main tables:

1. **conversations** - Store chat conversations with AI models/agents
2. **messages** - Store individual messages with branching support
3. **agents** - Store custom AI agents with tools and instructions

All schemas follow multi-tenant isolation patterns with `tenantId` fields and proper indexes for performance.

---

## Schema Files

### 1. Conversations (`database/schema/conversations.ts`)

Stores AI chat conversations with configuration and model parameters.

**Key Features:**
- Multi-tenant isolation with `tenantId`
- Supports multiple AI providers (OpenAI, Anthropic, xAI, Bedrock)
- Configurable model parameters (temperature, topP, maxTokens)
- Optional agent association
- Tracks last message timestamp for sorting
- Archive functionality

**Fields:**
```typescript
{
  id: uuid                    // Primary key
  tenantId: uuid              // Tenant isolation (FK to tenants)
  userId: uuid                // Conversation owner (FK to users)
  title: text                 // Conversation title
  provider: text              // 'openai' | 'anthropic' | 'xai' | 'bedrock'
  model: text                 // Model identifier (e.g., 'gpt-4', 'claude-3-sonnet')
  agentId: text               // Optional agent reference (FK to agents)
  parameters: jsonb           // Model parameters (temperature, topP, maxTokens, etc.)
  systemPrompt: text          // Optional system prompt override
  archived: boolean           // Archive status
  createdAt: timestamp
  updatedAt: timestamp
  lastMessageAt: timestamp    // Last message timestamp for sorting
}
```

**Indexes:**
- `tenantId` - Fast tenant queries
- `userId` - User's conversations
- `agentId` - Agent usage tracking
- `lastMessageAt` - Sorting by recent activity
- `(userId, tenantId)` - Compound index for user's conversations in tenant

**Example Usage:**
```typescript
import { db } from '@/server/db';
import { conversations } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';

// Create a new conversation
const newConversation = await db.insert(conversations).values({
  tenantId: user.tenantId,
  userId: user.id,
  title: 'New Chat',
  provider: 'openai',
  model: 'gpt-4',
  parameters: {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  },
}).returning();

// Get user's conversations
const userConversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, user.tenantId),
    eq(conversations.userId, user.id),
    eq(conversations.archived, false)
  ),
  orderBy: [desc(conversations.lastMessageAt)],
  with: {
    messages: {
      limit: 1,
      orderBy: [desc(messages.createdAt)],
    },
  },
});

// Get conversation with agent
const conversationWithAgent = await db.query.conversations.findFirst({
  where: eq(conversations.id, conversationId),
  with: {
    agent: true,
    messages: true,
  },
});
```

---

### 2. Messages (`database/schema/messages.ts`)

Stores individual messages within conversations with support for branching (alternative conversation paths).

**Key Features:**
- Multi-tenant isolation
- Message branching support via `parentMessageId`
- Token usage tracking
- Tool calling support
- Full-text search on message content
- Error handling and status flags

**Fields:**
```typescript
{
  id: uuid                    // Primary key
  tenantId: uuid              // Tenant isolation (FK to tenants)
  conversationId: uuid        // Parent conversation (FK to conversations)
  content: text               // Message content
  role: text                  // 'user' | 'assistant' | 'system' | 'tool'
  parentMessageId: uuid       // Self-reference for branching (nullable)
  model: text                 // Model used for AI responses
  provider: text              // Provider used
  finishReason: text          // 'stop' | 'length' | 'tool_calls' | 'content_filter'
  promptTokens: integer       // Token usage
  completionTokens: integer   // Token usage
  totalTokens: integer        // Total token usage
  toolCallId: text            // Tool call identifier
  toolName: text              // Tool name for tool messages
  error: boolean              // Error flag
  errorMessage: text          // Error details
  cancelled: boolean          // Cancellation flag
  unfinished: boolean         // Incomplete message flag
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**
- `tenantId` - Tenant isolation
- `conversationId` - Fast conversation queries
- `parentMessageId` - Message tree navigation
- `role` - Filter by message type
- `(conversationId, createdAt)` - Ordered conversation messages
- **Full-text search index** on `content` using PostgreSQL `to_tsvector`

**Message Branching:**

Messages support branching via the `parentMessageId` field, allowing users to explore alternative conversation paths:

```
Message A (user)
├── Message B1 (assistant) - First response
│   └── Message C1 (user) - Continuation
└── Message B2 (assistant) - Alternative response
    └── Message C2 (user) - Alternative continuation
```

**Example Usage:**
```typescript
import { db } from '@/server/db';
import { messages } from '@/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Create a user message
const userMessage = await db.insert(messages).values({
  tenantId: user.tenantId,
  conversationId: conversation.id,
  content: 'Hello, how can you help me?',
  role: 'user',
  parentMessageId: null, // First message in thread
}).returning();

// Create an assistant response
const assistantMessage = await db.insert(messages).values({
  tenantId: user.tenantId,
  conversationId: conversation.id,
  content: 'I can help you with various tasks...',
  role: 'assistant',
  model: 'gpt-4',
  provider: 'openai',
  finishReason: 'stop',
  promptTokens: 15,
  completionTokens: 42,
  totalTokens: 57,
  parentMessageId: userMessage.id, // Reference to user message
}).returning();

// Get conversation messages in order
const conversationMessages = await db.query.messages.findMany({
  where: and(
    eq(messages.tenantId, user.tenantId),
    eq(messages.conversationId, conversationId)
  ),
  orderBy: [asc(messages.createdAt)],
});

// Search messages with full-text search
const searchResults = await db.select()
  .from(messages)
  .where(
    and(
      eq(messages.tenantId, user.tenantId),
      sql`to_tsvector('english', ${messages.content}) @@ to_tsquery('business & strategy')`
    )
  )
  .limit(20);

// Get message tree (for branching visualization)
const messageWithChildren = await db.query.messages.findFirst({
  where: eq(messages.id, messageId),
  with: {
    childMessages: {
      with: {
        childMessages: true, // Recursive loading
      },
    },
  },
});
```

---

### 3. Agents (`database/schema/agents.ts`)

Stores custom AI agents with specialized instructions, tools, and configuration.

**Key Features:**
- Multi-tenant isolation
- Custom agent IDs (e.g., 'agent_abc123')
- Tool configuration (file search, code interpreter, web search, Composio)
- Version tracking
- Usage statistics
- System agents vs user-created agents
- Tier-based access control

**Fields:**
```typescript
{
  id: text                    // Custom ID (e.g., 'agent_abc123')
  tenantId: uuid              // Tenant isolation (FK to tenants)
  createdBy: uuid             // Creator (FK to users, nullable)
  name: text                  // Agent name
  description: text           // Agent description
  instructions: text          // System instructions
  provider: text              // 'openai' | 'anthropic' | 'xai' | 'bedrock'
  model: text                 // Model identifier
  tools: jsonb                // Array of tool names
  toolResources: jsonb        // Tool configuration
  parameters: jsonb           // Model parameters
  icon: text                  // Icon identifier
  avatar: jsonb               // Avatar configuration
  tier: text                  // 'free' | 'pro' | 'enterprise'
  published: boolean          // Published status
  isSystem: boolean           // System-provided agent flag
  version: integer            // Version number
  usageCount: integer         // Usage tracking
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Tool Resources Structure:**
```typescript
toolResources: {
  fileSearch?: {
    fileIds: string[];
    vectorStoreIds?: string[];
  };
  codeInterpreter?: {
    fileIds: string[];
  };
  webSearch?: {
    enabled: boolean;
  };
  composio?: {
    actions: string[]; // e.g., ['GITHUB_GET_REPOS', 'GMAIL_SEND_EMAIL']
  };
}
```

**Indexes:**
- `tenantId` - Tenant isolation
- `createdBy` - User's agents
- `published` - Published agents
- `isSystem` - System vs user agents
- `tier` - Tier filtering
- `(tenantId, published)` - Tenant's published agents

**Example Usage:**
```typescript
import { db } from '@/server/db';
import { agents } from '@/database/schema';
import { eq, and } from 'drizzle-orm';

// Create a custom agent
const newAgent = await db.insert(agents).values({
  id: 'agent_' + crypto.randomUUID().slice(0, 8),
  tenantId: user.tenantId,
  createdBy: user.id,
  name: 'Business Strategy Agent',
  description: 'Helps with business strategy and planning',
  instructions: 'You are a business strategy expert...',
  provider: 'anthropic',
  model: 'claude-3-sonnet',
  tools: ['file_search', 'web_search'],
  toolResources: {
    fileSearch: {
      fileIds: ['file1', 'file2'],
    },
    webSearch: {
      enabled: true,
    },
  },
  parameters: {
    temperature: 0.7,
    maxTokens: 4096,
  },
  tier: 'pro',
  published: true,
  isSystem: false,
}).returning();

// Get published agents for tenant
const publishedAgents = await db.query.agents.findMany({
  where: and(
    eq(agents.tenantId, user.tenantId),
    eq(agents.published, true)
  ),
  orderBy: [desc(agents.usageCount)],
});

// Get system agents (available to all tenants)
const systemAgents = await db.query.agents.findMany({
  where: eq(agents.isSystem, true),
});

// Update agent usage count
await db.update(agents)
  .set({
    usageCount: sql`${agents.usageCount} + 1`,
  })
  .where(eq(agents.id, agentId));
```

---

## Relations

All three schemas define Drizzle relations for type-safe queries:

**Conversations Relations:**
```typescript
conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants),
  user: one(users),
  messages: many(messages),
  // agent relation added when agents schema is imported
}));
```

**Messages Relations:**
```typescript
messagesRelations = relations(messages, ({ one, many }) => ({
  tenant: one(tenants),
  conversation: one(conversations),
  parentMessage: one(messages), // Self-reference for branching
  childMessages: many(messages), // Children in the tree
}));
```

**Agents Relations:**
```typescript
agentsRelations = relations(agents, ({ one, many }) => ({
  tenant: one(tenants),
  creator: one(users),
  conversations: many(conversations),
}));
```

---

## Multi-Tenant Isolation

**Critical**: All queries MUST filter by `tenantId` to ensure data isolation.

**Example Middleware Pattern:**
```typescript
// Inject tenant context into every request
app.use(async (c, next) => {
  const session = await getSession(c);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  c.set('tenantId', user.tenantId);
  c.set('userId', user.id);

  await next();
});

// Every query MUST filter by tenantId
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, c.get('tenantId')), // REQUIRED
    eq(conversations.userId, c.get('userId'))
  ),
});
```

---

## Migration

To generate and apply migrations for these schemas:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migration to database
npx drizzle-kit push

# Or use Drizzle Studio to view/edit data
npx drizzle-kit studio
```

---

## Performance Considerations

1. **Indexes**: All critical query paths have indexes (tenant, user, conversation, parent)
2. **Full-text search**: Messages use PostgreSQL `to_tsvector` for fast content search
3. **Compound indexes**: Multi-column indexes for common query patterns
4. **Cascading deletes**: FK constraints with `onDelete: 'cascade'` for automatic cleanup

---

## Next Steps

1. **API Endpoints**: Create Hono routes for CRUD operations (see `/REBUILD/api-endpoints.md`)
2. **oRPC Integration**: Add Zod validation to enable auto-tool generation
3. **Frontend Components**: Build UI components with Vercel AI SDK
4. **RAG Integration**: Add `document_chunks` schema for vector search

---

## Related Documentation

- `/REBUILD/data-models.md` - Complete data model specifications
- `/REBUILD/architecture.md` - System architecture and patterns
- `/REBUILD/api-endpoints.md` - API endpoint documentation
- `/database/schema/auth.ts` - User authentication schema
- `/database/schema/tenants.ts` - Multi-tenancy schema
