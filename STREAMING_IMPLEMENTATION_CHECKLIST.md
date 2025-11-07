# AI Chat Streaming Implementation Checklist

## Overview
This checklist guides you through implementing production-ready AI chat streaming with Cloudflare Workers, based on the ShadFlareAi architecture.

## Phase 1: Core Streaming (✅ COMPLETE)

### Backend Streaming
- [x] Vercel AI SDK integration (`streamText()`)
- [x] Multi-provider support (OpenAI, Anthropic, xAI)
- [x] SSE response via `toDataStreamResponse()`
- [x] Error handling for missing API keys
- [x] Temperature and max tokens configuration

**Files**: 
- `/src/server/routes/chat.ts` - Main chat endpoint
- `/src/lib/ai-providers.ts` - Provider configuration

### Frontend Streaming
- [x] `useChat` hook integration from `ai/react`
- [x] Real-time message rendering
- [x] Loading state management
- [x] Error display
- [x] Auto-scroll to latest message

**Files**:
- `/src/routes/_authenticated/ai-chat/index.tsx` - Chat UI
- `/src/routes/_authenticated/ai-chat/$conversationId.tsx` - Conversation view

---

## Phase 2: Database Persistence (⏳ IN PROGRESS)

### Message Storage
- [ ] Save user messages to database
  - Location: Before streaming starts in `POST /api/v1/chat`
  - Fields: `conversationId`, `tenantId`, `userId`, `role: 'user'`, `content`, `createdAt`
  
- [ ] Save assistant messages to database
  - Location: In `onFinish` callback of `streamText()`
  - Fields: Same as above + `finishReason`, `tokenUsage`
  
**Implementation Pattern**:
```typescript
// Save user message
const userMsg = await db.insert(messages).values({
  conversationId,
  tenantId: organizationId,
  userId: user.id,
  role: 'user',
  content: message,
})

// Stream with persistence
const result = await streamText({
  model: aiModel,
  messages,
  onFinish: async ({ text, usage }) => {
    await db.insert(messages).values({
      conversationId,
      tenantId: organizationId,
      userId: user.id,
      role: 'assistant',
      content: text,
      finishReason: finishReason,
      tokenUsage: usage?.totalTokens,
    })
  },
})

return result.toDataStreamResponse()
```

### Conversation Management
- [ ] Get or create conversation
  - Fetch existing by ID + tenantId + userId
  - Create new if not found
  - Extract title from first user message (truncate to 100 chars)

- [ ] Update conversation metadata
  - `lastMessageAt` timestamp on new messages
  - `messageCount` increment
  - `lastAssistantMessage` preview

**Implementation Pattern**:
```typescript
// Get or create
let conversation = await db.query.conversations.findFirst({
  where: and(
    eq(conversations.id, conversationId || ''),
    eq(conversations.tenantId, organizationId)
  )
})

if (!conversation && message) {
  const title = message.substring(0, 100)
  conversation = await db.insert(conversations).values({
    tenantId: organizationId,
    userId: user.id,
    title,
  })
}

// Update on new message
await db.update(conversations)
  .set({ lastMessageAt: new Date(), messageCount: sql`message_count + 1` })
  .where(eq(conversations.id, conversation.id))
```

---

## Phase 3: API Endpoints (⏳ TODO)

### GET /api/v1/chat/:conversationId
- [ ] Fetch conversation with messages
- [ ] Pagination support (limit, offset)
- [ ] Tenant isolation check
- [ ] Order by created_at desc

### GET /api/v1/chat
- [ ] List user's conversations
- [ ] Pagination (limit, offset)
- [ ] Sort by lastMessageAt desc
- [ ] Filter archived conversations
- [ ] Include messageCount and lastMessage preview

### DELETE /api/v1/chat/:conversationId
- [ ] Soft delete (set archived = true)
- [ ] Tenant isolation check
- [ ] Return success response

### POST /api/v1/chat/:conversationId/archive
- [ ] Alternative soft delete endpoint
- [ ] Same behavior as DELETE

---

## Phase 4: Agent System (⏳ TODO)

### Agent Configuration
- [ ] Create agents table with:
  - `id`, `tenantId`, `name`, `description`
  - `systemPrompt`, `tools[]`, `model`
  - `parameters` (temperature, maxTokens, etc.)
  
- [ ] Support multiple agents per tenant
- [ ] Agent selection in chat endpoint
  - via `agentId` parameter
  - Apply agent's system prompt to messages

**Implementation**:
```typescript
const result = await streamText({
  system: agentSystemPrompt, // From agent config
  model: aiModel,
  messages,
  tools: agentTools, // From agent.tools[]
})
```

---

## Phase 5: Token Tracking (⏳ TODO)

### Usage Metrics
- [ ] Store token usage per message:
  - `promptTokens`, `completionTokens`, `totalTokens`
  
- [ ] Aggregate per conversation:
  - Total tokens used
  
- [ ] Aggregate per user/tenant:
  - Daily usage count
  - Monthly usage count
  - Cost calculation

**Implementation**:
```typescript
// In messages table
await db.insert(messages).values({
  conversationId,
  content: text,
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  totalTokens: usage.totalTokens,
})

// Optional: Insert usage_summary record
await db.insert(usageSummary).values({
  tenantId: organizationId,
  userId: user.id,
  model,
  promptTokens,
  completionTokens,
  totalTokens,
  cost: totalTokens * costPerToken,
})
```

---

## Phase 6: Advanced Features (⏳ TODO)

### Message Branching
- [ ] Support multiple assistant responses
- [ ] Store parentMessageId for conversation tree
- [ ] Allow "regenerate" response feature

### Streaming Optimization
- [ ] Consider token limit enforcement
- [ ] Handle long-running requests gracefully
- [ ] Implement request timeout (30s recommended)

### Conversation Features
- [ ] Rename conversations
- [ ] Share conversations with team
- [ ] Export conversation as PDF
- [ ] Search within conversations

---

## Database Schemas

### conversations table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  archived BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### messages table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  
  model TEXT, -- GPT-4o, Claude, etc.
  finish_reason TEXT, -- stop, length, etc.
  
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  created_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
)
```

---

## Testing Checklist

- [ ] Single message streaming works
- [ ] Multi-turn conversation accumulates context
- [ ] Messages persist to database
- [ ] Tenant isolation (can't access other tenant's conversations)
- [ ] User isolation (can't access other user's conversations)
- [ ] Regenerate response overwrites previous assistant message
- [ ] Very long responses (>4000 chars) stream correctly
- [ ] Connection lost mid-stream gracefully fails
- [ ] Multiple concurrent chats work independently
- [ ] Model switching (GPT-4o to Claude) works
- [ ] API key rotation doesn't break active streams

---

## Performance Targets

- **First response token**: < 1 second
- **Token throughput**: 10+ tokens/sec
- **Message persistence**: < 100ms after streaming complete
- **Database queries**: < 50ms for list/get operations
- **Concurrent users**: Support 100+ simultaneous streams

---

## Monitoring & Debugging

### Key Metrics
- [ ] Stream response time (first token latency)
- [ ] Token throughput
- [ ] API error rates by provider
- [ ] Database persistence latency
- [ ] Concurrent active streams

### Logging
- [ ] Log each chat request with model, message length
- [ ] Log streaming duration and token count
- [ ] Log any persistence failures (with retry info)
- [ ] Use structured logging (JSON format for analysis)

### Example Log Pattern
```typescript
console.log('🤖 Chat request:', { 
  userId: user.id, 
  organizationId, 
  conversationId, 
  model, 
  messageLength: message.length,
  timestamp: new Date().toISOString()
})

console.log('✅ Stream complete:', {
  conversationId,
  finishReason,
  tokenCount: usage.totalTokens,
  duration: Date.now() - startTime,
})
```

---

## Next Steps

1. **Immediate** (This sprint):
   - [ ] Implement message persistence in `onFinish`
   - [ ] Add conversation GET/LIST endpoints
   - [ ] Test multi-turn conversations

2. **Short-term** (Next sprint):
   - [ ] Implement DELETE/archive endpoint
   - [ ] Add agent system support
   - [ ] Token tracking and limits

3. **Medium-term**:
   - [ ] Message branching and regeneration
   - [ ] Conversation search
   - [ ] Team sharing features

