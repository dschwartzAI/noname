# Quick Start: Chat System Schemas

## Files Created

```
database/schema/
├── conversations.ts       (2.7K) - Chat conversations
├── messages.ts            (3.2K) - Chat messages with branching
├── agents.ts              (3.5K) - Custom AI agents
├── index.ts               (Updated) - Exports all schemas
└── CHAT_SCHEMAS_README.md (Complete documentation)
```

## What's Included

### 1. Conversations Schema
- Multi-tenant isolation
- Supports OpenAI, Anthropic, xAI, Bedrock
- Configurable model parameters
- Optional agent association
- Archive functionality

### 2. Messages Schema
- Message branching support (explore alternative paths)
- Full-text search on content
- Token usage tracking
- Tool calling support
- Error handling

### 3. Agents Schema
- Custom AI agents with tools
- System agents vs user-created
- Tool resources (file search, code interpreter, web search, Composio)
- Version tracking and usage stats
- Tier-based access control

## Quick Usage Examples

### Create a Conversation
```typescript
import { db } from '@/server/db';
import { conversations } from '@/database/schema';

const conversation = await db.insert(conversations).values({
  tenantId: user.tenantId,
  userId: user.id,
  title: 'New Chat',
  provider: 'openai',
  model: 'gpt-4',
}).returning();
```

### Add Messages
```typescript
import { messages } from '@/database/schema';

// User message
const userMsg = await db.insert(messages).values({
  tenantId: user.tenantId,
  conversationId: conversation.id,
  content: 'Hello!',
  role: 'user',
}).returning();

// AI response
await db.insert(messages).values({
  tenantId: user.tenantId,
  conversationId: conversation.id,
  content: 'Hi! How can I help?',
  role: 'assistant',
  model: 'gpt-4',
  parentMessageId: userMsg.id,
  promptTokens: 10,
  completionTokens: 20,
});
```

### Create an Agent
```typescript
import { agents } from '@/database/schema';

const agent = await db.insert(agents).values({
  id: 'agent_' + crypto.randomUUID().slice(0, 8),
  tenantId: user.tenantId,
  createdBy: user.id,
  name: 'Business Coach',
  instructions: 'You are a business strategy expert...',
  provider: 'anthropic',
  model: 'claude-3-sonnet',
  tools: ['file_search', 'web_search'],
  published: true,
}).returning();
```

### Query with Relations
```typescript
// Get conversation with messages and agent
const conv = await db.query.conversations.findFirst({
  where: eq(conversations.id, conversationId),
  with: {
    messages: {
      orderBy: [asc(messages.createdAt)],
    },
    agent: true,
  },
});
```

## Key Features

### Multi-Tenant Isolation
**Every query MUST filter by `tenantId`:**
```typescript
where: and(
  eq(table.tenantId, tenantId), // REQUIRED
  eq(table.userId, userId)
)
```

### Message Branching
Explore alternative conversation paths:
```
Message A (user)
├── Response B1 (via parentMessageId)
└── Response B2 (alternative path)
```

### Full-Text Search
Search message content:
```typescript
sql`to_tsvector('english', ${messages.content}) @@ to_tsquery('search terms')`
```

### Agent Tools
Agents support multiple tool types:
- File search (RAG)
- Code interpreter
- Web search
- Composio integrations (GitHub, Gmail, etc.)

## Migration Commands

```bash
# Generate migration
npx drizzle-kit generate

# Apply to database
npx drizzle-kit push

# Open Drizzle Studio
npx drizzle-kit studio
```

## Next Steps

1. **Generate Migration**: Run `npx drizzle-kit generate` to create SQL migration
2. **Apply Schema**: Run `npx drizzle-kit push` to apply to Neon database
3. **Create API Routes**: Build Hono endpoints for CRUD operations
4. **Add Zod Validation**: Enable oRPC auto-tool generation
5. **Build UI**: Create frontend components with Vercel AI SDK

## Important Notes

- All tables use UUID primary keys (except agents which use text IDs)
- Cascading deletes configured on foreign keys
- Proper indexes for performance (tenant, user, conversation)
- Relations defined for type-safe Drizzle queries
- Full TypeScript type inference with `$inferSelect` and `$inferInsert`

## Related Files

- `/REBUILD/data-models.md` - Complete specifications
- `/database/schema/auth.ts` - User authentication
- `/database/schema/tenants.ts` - Multi-tenancy
- `CHAT_SCHEMAS_README.md` - Detailed documentation
