# ShadFlareAi Streaming Quick Reference

## The 4 Core Concepts

### 1. Backend Streaming (`streamText`)
```typescript
const result = await streamText({
  model: aiModel,           // Vercel AI SDK model instance
  messages: [...],          // Chat history
  temperature: 0.7,
  maxTokens: 2048,
  onFinish: async (data) => {
    // Persist to database after streaming completes
    await db.insert(messages).values({
      conversationId,
      role: 'assistant',
      content: data.text,
      totalTokens: data.usage.totalTokens,
    })
  }
})

return result.toDataStreamResponse()  // SSE format
```

### 2. Frontend Streaming (`useChat`)
```typescript
const { 
  messages,              // Accumulated message array
  input,                 // Current user input
  handleInputChange,     // Update input state
  handleSubmit,          // Send message
  isLoading,            // Streaming state
  error                 // Error from API
} = useChat({
  api: '/api/v1/chat',  // Backend endpoint
  body: { model: 'gpt-4o' }
})

// useChat automatically:
// - Sends POST request with messages
// - Listens to SSE response stream
// - Parses "data: {JSON}" lines
// - Appends message chunks in real-time
// - Updates UI on each token
```

### 3. SSE Protocol (Transport Layer)
**Server Response Format**:
```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}\n\n
data: {"id":"...","choices":[{"delta":{"content":" world"}}]}\n\n
data: [DONE]\n\n
```

**Browser EventSource** (automatic in `useChat`):
```javascript
const es = new EventSource('/api/v1/chat')
es.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)
  if (data === '[DONE]') es.close()
  else displayChunk(data.choices[0].delta.content)
})
```

### 4. Database Persistence (onFinish Callback)
```typescript
// Execute after streaming completes
onFinish: async ({ text, usage, finishReason }) => {
  // At this point, `text` contains FULL response
  await db.insert(messages).values({
    conversationId,
    role: 'assistant',
    content: text,                      // Full text available
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    finishReason: finishReason,         // 'stop', 'length', etc
  })
}
```

---

## File Structure (Your Project)

```
src/
├── server/
│   ├── routes/
│   │   └── chat.ts              ← POST /api/v1/chat endpoint
│   │   └── middleware/
│   │       ├── auth.ts          ← requireAuth middleware
│   │       └── organization.ts  ← injectOrganization (tenantId)
│   └── index.ts                 ← Server setup + chat route registration
├── lib/
│   └── ai-providers.ts          ← getModel() helper for Claude/GPT/Grok
└── routes/_authenticated/
    └── ai-chat/
        └── index.tsx             ← ChatPage component with useChat

database/schema/
├── conversations.ts             ← Conversations table schema
└── messages.ts                  ← Messages table schema
```

---

## Key Implementation Pattern

```typescript
// 1. POST handler receives chat request
chatApp.post('/', async (c) => {
  const { message, messages: messagesArray, model, conversationId } = c.req.valid('json')
  const user = c.get('user')
  const organizationId = c.get('organizationId')

  // 2. Get AI model instance
  const aiModel = getModel(env, model)

  // 3. Stream text response
  const result = await streamText({
    model: aiModel,
    messages: messagesArray || [{ role: 'user', content: message }],
    onFinish: async ({ text, usage }) => {
      // 4. Persist after stream complete
      await db.insert(messages).values({
        conversationId,
        tenantId: organizationId,
        role: 'assistant',
        content: text,
        totalTokens: usage.totalTokens,
      })
    }
  })

  // 5. Return SSE stream to browser
  return result.toDataStreamResponse()
})
```

---

## Multi-Provider Configuration

### Provider Detection
```typescript
// In ai-providers.ts getModel() function
if (modelName.startsWith('claude-')) {
  // Use Anthropic provider
  const anthropic = createAnthropic({ apiKey })
  return anthropic(modelName)  // Returns "claude-3-sonnet-..."
}

if (modelName.startsWith('grok-')) {
  // Use xAI provider (OpenAI-compatible API)
  const xai = createOpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'  // Custom endpoint
  })
  return xai(modelName)
}

// Default: OpenAI
const openai = createOpenAI({ apiKey })
return openai(modelName)  // Returns "gpt-4o", etc
```

### Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=...
```

---

## Error Handling

### Backend
```typescript
try {
  const aiModel = getModel(env, model)
  // Will throw if API key not configured
  
  const result = await streamText({ ... })
  return result.toDataStreamResponse()
} catch (error) {
  if (error.message.includes('API key')) {
    return c.json({ error: 'AI provider API key not configured' }, 500)
  }
  return c.json({ error: error.message }, 500)
}
```

### Frontend
```typescript
const { error } = useChat({
  api: '/api/v1/chat',
  onError: (error) => {
    console.error('Chat error:', error)
    // Error is automatically displayed in your error UI
  }
})

{error && (
  <div className="text-destructive">
    <p>Error: {error.message}</p>
  </div>
)}
```

---

## Common Issues & Solutions

### Issue 1: Messages not persisting
**Solution**: Ensure `onFinish` callback has database access
```typescript
onFinish: async ({ text, usage }) => {
  if (!conversationId) {
    console.warn('No conversationId, skipping persistence')
    return
  }
  // Persist code here
}
```

### Issue 2: Streaming stops mid-response
**Solution**: Check connection headers
```typescript
return result.toDataStreamResponse()
// Ensure NOT overriding headers with incorrect content-type
```

### Issue 3: Frontend not receiving messages
**Solution**: Verify API endpoint
```typescript
// Frontend must match backend route
const { messages } = useChat({ api: '/api/v1/chat' })

// Backend must be registered
app.route('/api/v1', chatApp)  // Routes POST /api/v1/chat
```

### Issue 4: Messages lose context in multi-turn
**Solution**: Include full message history in request
```typescript
// Frontend automatically sends all messages
const { messages } = useChat({ ... })
// Each request includes: [user1, assistant1, user2, assistant2, ...]

// Backend should use the messages array, not just new message
const result = await streamText({
  messages: messagesArray,  // Full history for context
})
```

---

## Testing the Stream

### cURL Test
```bash
curl -X POST http://localhost:5174/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: [session-cookie]" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o"
  }' \
  -N  # Important: raw output without buffering
```

### Expected Response
```
data: {"id":"...","choices":[{"delta":{"content":"H"}}]}

data: {"id":"...","choices":[{"delta":{"content":"ello"}}]}

data: {"id":"...","choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

---

## Performance Optimization Tips

1. **Token Limits**: Set reasonable `maxTokens`
   - Shorter responses = faster streaming
   - Set to 2048 for most conversations
   - Consider 4096+ only for specialized tasks

2. **Temperature**: Lower = faster
   - 0.0 = Most deterministic, fastest
   - 0.7 = Good balance
   - 1.0+ = More creative, slightly slower

3. **Batch Messages**: Don't send redundant history
   - Include last 10-20 messages, not entire conversation
   - Use summarization for very long conversations

4. **Connection Reuse**: Browser keeps connection alive
   - useChat automatically reuses connections
   - No need for connection pooling in most cases

---

## Architecture Decision Points

### Q: Why SSE instead of WebSocket?
**A**: SSE is better for one-way streaming (server → browser). WebSocket is for bidirectional chat.
- Use SSE for: Chat streaming responses
- Use WebSocket for: Real-time collaborative editing, voice

### Q: Why persist in onFinish instead of streaming?
**A**: Ensures complete, validated response before database commit
- `onFinish`: Has full `text` and `usage` data
- During stream: Only partial chunks available
- Exception: Voice/file uploads need streaming writes

### Q: Why not use Cloudflare Workers AI directly?
**A**: Vercel AI SDK provides vendor-agnostic abstraction
- Supports: Claude, GPT-4o, Grok, and Workers AI
- Easy provider switching (just change model name)
- Better error handling and type safety

### Q: Why manual SSE wrapper for Workers AI?
**A**: `toDataStreamResponse()` isn't available for all models
- Vercel SDK streams to proprietary format
- Manual conversion gives compatibility with `useChat`
- Required for Google Gemini integration

---

## Key Files in Your Project

| File | Purpose | Status |
|------|---------|--------|
| `/src/server/routes/chat.ts` | Main chat endpoint | ✅ Complete |
| `/src/lib/ai-providers.ts` | Provider configuration | ✅ Complete |
| `/src/routes/_authenticated/ai-chat/index.tsx` | Chat UI | ✅ Complete |
| `/src/server/middleware/auth.ts` | Authentication | ✅ Complete |
| `/src/server/middleware/organization.ts` | Tenant injection | ✅ Complete |
| `/database/schema/conversations.ts` | DB schema | ⏳ Needs migration |
| `/database/schema/messages.ts` | DB schema | ⏳ Needs migration |

---

## Next Immediate Tasks

1. **Create message persistence in `onFinish`**
   - Location: `/src/server/routes/chat.ts` line 108
   - Use provided implementation pattern above

2. **Implement GET /api/v1/chat/:conversationId**
   - Fetch conversation with messages
   - Return with pagination

3. **Implement GET /api/v1/chat**
   - List conversations for user
   - Sort by lastMessageAt desc

That's it! Everything else is built on top of this foundation.
