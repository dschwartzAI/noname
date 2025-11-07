# Chat API Quick Start Guide

## 🚀 Quick Start

### 1. Test the Streaming Endpoint (Working Now)

The streaming endpoint is **ready to use** right now:

```bash
# 1. Start dev server
npm run dev

# 2. Get auth cookie
curl -X POST http://localhost:5174/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "password": "password123"}' \
  -c cookies.txt

# 3. Send chat message (streams back AI response)
curl -X POST http://localhost:5174/api/v1/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "message": "Tell me a short joke",
    "model": "gpt-4o"
  }'
```

**Expected**: Streaming AI response from GPT-4o

### 2. Frontend Integration

```typescript
// In any authenticated route
import { useChat } from 'ai/react'

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/v1/chat',
    body: { model: 'gpt-4o' }
  })

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.role}: {msg.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button disabled={isLoading}>Send</button>
      </form>
    </div>
  )
}
```

## 📝 What Works Now

✅ **POST `/api/v1/chat`** - Streaming AI chat (fully functional)
- Requires authentication
- Requires organization membership
- Streams responses using Vercel AI SDK
- Supports GPT-4o, Claude, Grok models

## ⚠️ What Needs Database Migration

🟡 **GET `/api/v1/chat/:conversationId`** - Get conversation history (returns 501)
🟡 **GET `/api/v1/chat`** - List conversations (returns empty array)
🟡 **DELETE `/api/v1/chat/:conversationId`** - Archive conversation (returns success but no-op)

These endpoints are **stubs** waiting for the database migration.

## 🔧 To Enable Full Functionality

### Step 1: Migrate Database Schema

The conversations and messages tables are defined but not yet integrated with Better Auth:

```bash
# Check schema files
ls database/schema/
# - conversations.ts (ready)
# - messages.ts (ready)
# - tenants.ts (needs integration with Better Auth organizations)
```

**Issue**: Current schema uses `tenantId` (UUID) but Better Auth uses `organizationId` (text)

**Fix Options**:

1. **Option A** (Recommended): Migrate Better Auth to use tenants table
   ```typescript
   // Update database/better-auth-schema.ts
   // Change organization.id from text to uuid
   // Add tenant_id to user table
   ```

2. **Option B**: Update conversations/messages to use organizationId
   ```typescript
   // Update database/schema/conversations.ts
   // Change tenantId to organizationId: text()
   ```

### Step 2: Run Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply to database
npx drizzle-kit push
```

### Step 3: Uncomment Database Logic in chat.ts

Search for `// TODO: Once conversations/messages tables are migrated` in:
- `src/server/routes/chat.ts`

Uncomment the database logic in:
1. POST handler (lines ~70-120)
2. GET conversation handler (lines ~170-190)
3. GET list handler (lines ~210-230)
4. DELETE handler (lines ~250-270)

### Step 4: Update Schema Import

```typescript
// In src/server/routes/chat.ts
// Change from:
import * as authSchema from '../../../database/better-auth-schema'

// To:
import * as schema from '../../../database/schema'
```

### Step 5: Test Full Flow

```bash
# Create conversation
curl -X POST http://localhost:5174/api/v1/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message": "Hello"}'

# List conversations
curl http://localhost:5174/api/v1/chat?limit=10 -b cookies.txt

# Get conversation history
curl http://localhost:5174/api/v1/chat/{conversationId} -b cookies.txt

# Archive conversation
curl -X DELETE http://localhost:5174/api/v1/chat/{conversationId} -b cookies.txt
```

## 🎯 Current Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /api/v1/chat | ✅ Working | Streaming AI responses functional |
| GET /api/v1/chat/:id | 🟡 Stub | Returns 501 - needs DB migration |
| GET /api/v1/chat | 🟡 Stub | Returns [] - needs DB migration |
| DELETE /api/v1/chat/:id | 🟡 Stub | Returns success - needs DB migration |

## 🔑 Required Environment Variables

```env
DATABASE_URL=postgresql://...  # Neon Postgres (required)
OPENAI_API_KEY=sk-...         # For GPT models
ANTHROPIC_API_KEY=sk-ant-...  # For Claude models (optional)
XAI_API_KEY=xai-...           # For Grok models (optional)
```

## 🧪 Testing Different Models

```bash
# GPT-4o (default)
curl -X POST http://localhost:5174/api/v1/chat \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "gpt-4o"}'

# Claude Sonnet
curl -X POST http://localhost:5174/api/v1/chat \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "claude-3-5-sonnet-20241022"}'

# Grok
curl -X POST http://localhost:5174/api/v1/chat \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "grok-beta"}'
```

## 📚 Documentation

- **Full Implementation Guide**: See `CHAT_API_IMPLEMENTATION.md`
- **API Schemas**: See `src/server/validation/chat.ts`
- **Database Schemas**: See `database/schema/conversations.ts` and `database/schema/messages.ts`
- **Swagger UI**: http://localhost:5174/api/ui

## 🐛 Troubleshooting

### Error: "No organization context"
**Cause**: User not a member of any organization
**Fix**: Add user to an organization via God Dashboard or API

### Error: "AI provider API key not configured"
**Cause**: Missing environment variable for the selected model
**Fix**: Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `XAI_API_KEY` to `.env.local`

### Error: "Unauthorized"
**Cause**: No valid session cookie
**Fix**: Sign in first and use the session cookie in requests

### Streaming doesn't work
**Cause**: Using wrong Content-Type or expecting JSON response
**Fix**: The response is a stream, not JSON. Use libraries like Vercel AI SDK's `useChat`

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ Streaming responses appear in real-time
2. ✅ Multiple models (GPT-4o, Claude, Grok) work
3. ✅ No "Unauthorized" errors with valid session
4. ✅ No "No organization context" errors
5. ✅ Frontend `useChat` hook displays messages

## 🚦 Next Steps

1. **Immediate**: Test streaming endpoint (already works!)
2. **Short-term**: Migrate database schema (enables persistence)
3. **Medium-term**: Build frontend chat UI with `useChat`
4. **Long-term**: Add agents, RAG, memory integration

---

**Ready to test?** Run `npm run dev` and try the curl commands above!
