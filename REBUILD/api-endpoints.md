# API Endpoints Documentation

> **Related Docs**: [Data Models](./data-models.md) | [Architecture](./architecture.md) | [Features](./features.md) | [Starter Integration](./starter-integration.md)

## Current API Surface (Express.js)

### Base URL: `http://localhost:3080/api`

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login with email/password | No |
| POST | `/auth/logout` | Logout current user | Yes |
| POST | `/auth/refresh` | Refresh JWT token | Yes |
| GET | `/auth/user` | Get current user | Yes |
| POST | `/auth/forgot-password` | Send password reset email | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| GET | `/auth/verify-email` | Verify email address | No |

### OAuth Routes (`/oauth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/oauth/google` | Initiate Google OAuth |
| GET | `/oauth/google/callback` | Google OAuth callback |
| GET | `/oauth/github` | Initiate GitHub OAuth |
| GET | `/oauth/github/callback` | GitHub OAuth callback |
| GET | `/oauth/discord` | Initiate Discord OAuth |
| GET | `/oauth/discord/callback` | Discord OAuth callback |

### Conversation Routes (`/api/convos`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/convos` | List user's conversations | Yes |
| GET | `/convos/:conversationId` | Get conversation by ID | Yes |
| POST | `/convos` | Create new conversation | Yes |
| POST | `/convos/gen` | Generate conversation title | Yes |
| PATCH | `/convos/:conversationId` | Update conversation | Yes |
| PUT | `/convos/:conversationId` | Replace conversation | Yes |
| DELETE | `/convos/:conversationId` | Delete conversation | Yes |
| DELETE | `/convos` | Delete all conversations | Yes |

### Message Routes (`/api/messages`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/messages/:conversationId` | Get messages for conversation | Yes |
| POST | `/messages/ask` | Send message (streaming) | Yes |
| POST | `/messages/ask/:conversationId` | Continue conversation | Yes |
| POST | `/messages/continue` | Continue incomplete message | Yes |
| POST | `/messages/regenerate` | Regenerate message | Yes |
| DELETE | `/messages/:messageId` | Delete message | Yes |

### Agent Routes (`/api/agents`)

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/agents` | List agents | Yes | - |
| GET | `/agents/:id` | Get agent by ID | Yes | - |
| POST | `/agents` | Create agent | Yes | admin/pro |
| PATCH | `/agents/:id` | Update agent | Yes | admin/author |
| DELETE | `/agents/:id` | Delete agent | Yes | admin/author |
| POST | `/agents/:id/avatar` | Upload agent avatar | Yes | admin/author |
| GET | `/agents/:id/versions` | Get agent version history | Yes | admin/author |
| POST | `/agents/:id/revert/:version` | Revert to version | Yes | admin/author |

### Assistant Routes (`/api/assistants`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/assistants` | List OpenAI assistants | Yes |
| GET | `/assistants/:id` | Get assistant by ID | Yes |
| POST | `/assistants` | Create assistant | Yes |
| PATCH | `/assistants/:id` | Update assistant | Yes |
| DELETE | `/assistants/:id` | Delete assistant | Yes |
| GET | `/assistants/:id/actions` | List assistant actions | Yes |
| POST | `/assistants/:id/actions` | Add action to assistant | Yes |

### File Routes (`/api/files`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/files` | List user's files | Yes |
| POST | `/files/upload` | Upload file | Yes |
| GET | `/files/:fileId` | Get file metadata | Yes |
| GET | `/files/download/:fileId` | Download file | Yes |
| DELETE | `/files/:fileId` | Delete file | Yes |
| POST | `/files/:fileId/embed` | Trigger RAG embedding | Yes |
| GET | `/files/:fileId/status` | Get embedding status | Yes |

### Search Routes (`/api/search`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/search` | Search conversations/messages | Yes |
| GET | `/search/conversations` | Search conversations only | Yes |
| GET | `/search/messages` | Search messages only | Yes |
| POST | `/search/sync` | Trigger search index sync | Yes (admin) |

### LMS Routes (`/api/lms`)

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/lms/courses` | List courses | Yes | - |
| GET | `/lms/courses/:id` | Get course details | Yes | tier check |
| POST | `/lms/courses` | Create course | Yes | admin |
| PATCH | `/lms/courses/:id` | Update course | Yes | admin |
| DELETE | `/lms/courses/:id` | Delete course | Yes | admin |
| GET | `/lms/modules/:id` | Get module details | Yes | tier check |
| POST | `/lms/modules` | Create module | Yes | admin |
| PATCH | `/lms/modules/:id` | Update module | Yes | admin |
| POST | `/lms/modules/:id/recording` | Attach recording | Yes | admin |

### Recording Routes (`/api/recordings`)

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/recordings` | List recordings | Yes | admin |
| GET | `/recordings/:id` | Get recording details | Yes | admin |
| POST | `/recordings/transfer` | Transfer to DO Spaces | Yes | admin |
| DELETE | `/recordings/:id` | Delete recording | Yes | admin |
| GET | `/recordings/search` | Search recordings | Yes | admin |

### Video Routes (`/api/video`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/video/create-call` | Create Stream call | Yes |
| GET | `/video/token` | Get Stream user token | Yes |
| GET | `/video/call/:callId` | Get call details | Yes |
| POST | `/video/end-call` | End call manually | Yes |

### CometChat Routes (`/api/cometchat`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/cometchat/auth` | Get CometChat auth token | Yes |
| GET | `/cometchat/user` | Get CometChat user | Yes |
| POST | `/cometchat/create-user` | Create CometChat user | Yes |
| PUT | `/cometchat/update-user` | Update CometChat user | Yes |

### Stripe Routes (`/api/stripe`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/stripe/create-checkout` | Create checkout session | Yes |
| GET | `/stripe/session/:sessionId` | Get session status | Yes |
| POST | `/stripe/webhook` | Stripe webhook handler | No (Stripe signature) |
| GET | `/stripe/customer-portal` | Get portal link | Yes |

### Admin Routes (`/api/admin`)

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/admin/users` | List all users | Yes | admin |
| GET | `/admin/users/:id` | Get user details | Yes | admin |
| PATCH | `/admin/users/:id` | Update user | Yes | admin |
| DELETE | `/admin/users/:id` | Delete user | Yes | admin |
| POST | `/admin/users/:id/ban` | Ban user | Yes | admin |
| POST | `/admin/users/:id/unban` | Unban user | Yes | admin |
| GET | `/admin/usage` | Get usage stats | Yes | admin |
| GET | `/admin/analytics` | Get analytics | Yes | admin |

---

## Target API (Hono + Cloudflare Workers)

### Base URL: `https://api.soloos.ai` (or custom domain per tenant)

### Design Principles

1. **RESTful** - Follow REST conventions
2. **Versioned** - `/v1/` prefix for version control
3. **Tenant-scoped** - Automatic tenant context from auth
4. **Type-safe** - Full TypeScript types
5. **Edge-compatible** - Works on Cloudflare Workers

### Auth Routes (`/v1/auth`)

| Method | Endpoint | Body | Response | Notes |
|--------|----------|------|----------|-------|
| POST | `/v1/auth/signup` | `{ email, password, name }` | `{ user, session }` | Email verification optional |
| POST | `/v1/auth/login` | `{ email, password }` | `{ user, session }` | Returns JWT + refresh token |
| POST | `/v1/auth/logout` | - | `{ success: true }` | Invalidates session |
| POST | `/v1/auth/refresh` | `{ refreshToken }` | `{ session }` | Get new access token |
| GET | `/v1/auth/me` | - | `{ user }` | Get current user |
| POST | `/v1/auth/forgot-password` | `{ email }` | `{ success: true }` | Sends reset email |
| POST | `/v1/auth/reset-password` | `{ token, password }` | `{ success: true }` | Reset with token |

### OAuth Routes (`/v1/auth/oauth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/auth/oauth/google` | Initiate Google OAuth |
| GET | `/v1/auth/oauth/google/callback` | Handle Google callback |
| GET | `/v1/auth/oauth/github` | Initiate GitHub OAuth |
| GET | `/v1/auth/oauth/github/callback` | Handle GitHub callback |

### Chat Routes (`/v1/chat`)

**Unified chat endpoint supporting all providers/agents**

| Method | Endpoint | Body | Response | Notes |
|--------|----------|------|----------|-------|
| POST | `/v1/chat` | `{ messages, model?, agentId?, stream? }` | SSE stream or JSON | Main chat endpoint |
| POST | `/v1/chat/completions` | OpenAI-compatible request | SSE stream or JSON | Drop-in OpenAI replacement |
| GET | `/v1/chat/models` | - | `{ models: [...] }` | List available models |

**Request Body**:
```typescript
{
  messages: Message[],
  model?: string,           // 'gpt-4' | 'claude-3-sonnet' | etc.
  agentId?: string,         // Use pre-configured agent
  stream?: boolean,         // Default: true
  temperature?: number,
  maxTokens?: number,
  tools?: string[],         // Tool IDs to enable
  // ... other parameters
}
```

**Streaming Response** (SSE):
```
data: {"type":"content","content":"Hello"}
data: {"type":"content","content":" world"}
data: {"type":"tool_call","toolId":"web_search","args":{...}}
data: {"type":"done","usage":{...}}
```

### Conversation Routes (`/v1/conversations`)

| Method | Endpoint | Query/Body | Response | Notes |
|--------|----------|------------|----------|-------|
| GET | `/v1/conversations` | `?limit=20&offset=0&agentId=...` | `{ conversations, total }` | List with pagination |
| GET | `/v1/conversations/:id` | - | `{ conversation, messages }` | Get with messages |
| POST | `/v1/conversations` | `{ title?, model, agentId? }` | `{ conversation }` | Create new |
| PATCH | `/v1/conversations/:id` | `{ title?, archived? }` | `{ conversation }` | Update |
| DELETE | `/v1/conversations/:id` | - | `{ success: true }` | Delete |
| GET | `/v1/conversations/:id/messages` | `?limit=50&before=...` | `{ messages, hasMore }` | Get messages |
| POST | `/v1/conversations/:id/fork` | `{ messageId }` | `{ conversation }` | Fork from message |

### Agent Routes (`/v1/agents`)

| Method | Endpoint | Body | Response | Auth Required |
|--------|----------|------|----------|---------------|
| GET | `/v1/agents` | - | `{ agents }` | Yes |
| GET | `/v1/agents/:id` | - | `{ agent }` | Yes |
| POST | `/v1/agents` | `AgentConfig` | `{ agent }` | admin/pro |
| PATCH | `/v1/agents/:id` | `Partial<AgentConfig>` | `{ agent }` | admin/author |
| DELETE | `/v1/agents/:id` | - | `{ success: true }` | admin/author |
| GET | `/v1/agents/:id/versions` | - | `{ versions }` | admin/author |
| POST | `/v1/agents/:id/publish` | - | `{ agent }` | admin |

**AgentConfig Type**:
```typescript
{
  name: string;
  description: string;
  instructions: string;
  model: string;
  provider: string;
  tools: string[];
  parameters?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
  icon?: string;
  tier: 'free' | 'pro';
}
```

### File Routes (`/v1/files`)

| Method | Endpoint | Body/Query | Response | Notes |
|--------|----------|------------|----------|-------|
| GET | `/v1/files` | `?limit=20&type=...` | `{ files }` | List files |
| POST | `/v1/files/upload` | `multipart/form-data` | `{ file }` | Upload file |
| GET | `/v1/files/:id` | - | `{ file }` | Get metadata |
| GET | `/v1/files/:id/download` | - | File stream | Download |
| DELETE | `/v1/files/:id` | - | `{ success: true }` | Delete |
| POST | `/v1/files/:id/embed` | - | `{ status: 'processing' }` | Start RAG embedding |

### RAG/Search Routes (`/v1/rag`)

| Method | Endpoint | Body | Response | Notes |
|--------|----------|------|----------|-------|
| POST | `/v1/rag/query` | `{ query, fileIds?, k? }` | `{ results }` | Search documents |
| POST | `/v1/rag/embed` | `{ fileId }` | `{ status }` | Manually trigger embedding |
| GET | `/v1/rag/status/:fileId` | - | `{ status, chunks }` | Embedding status |

### Memory Routes (`/v1/memory`)

| Method | Endpoint | Body | Response | Notes |
|--------|----------|------|----------|-------|
| GET | `/v1/memory` | `?category=...` | `{ memories }` | List user's memories |
| GET | `/v1/memory/:key` | - | `{ memory }` | Get specific memory |
| POST | `/v1/memory` | `{ key, value, category? }` | `{ memory }` | Create/update memory |
| DELETE | `/v1/memory/:key` | - | `{ success: true }` | Delete memory |
| GET | `/v1/memory/search` | `?q=...` | `{ memories }` | Search memories |

### LMS Routes (`/v1/lms`)

**Courses**:
| Method | Endpoint | Body | Response | Auth |
|--------|----------|------|----------|------|
| GET | `/v1/lms/courses` | - | `{ courses }` | Yes |
| GET | `/v1/lms/courses/:id` | - | `{ course, modules }` | tier check |
| POST | `/v1/lms/courses` | `CourseCreate` | `{ course }` | admin |
| PATCH | `/v1/lms/courses/:id` | `CourseUpdate` | `{ course }` | admin |
| DELETE | `/v1/lms/courses/:id` | - | `{ success: true }` | admin |

**Modules**:
| Method | Endpoint | Body | Response | Auth |
|--------|----------|------|----------|------|
| GET | `/v1/lms/modules/:id` | - | `{ module }` | tier check |
| POST | `/v1/lms/modules` | `ModuleCreate` | `{ module }` | admin |
| PATCH | `/v1/lms/modules/:id` | `ModuleUpdate` | `{ module }` | admin |
| DELETE | `/v1/lms/modules/:id` | - | `{ success: true }` | admin |

### Tenant Admin Routes (`/v1/admin/tenants`)

| Method | Endpoint | Body | Response | Auth |
|--------|----------|------|----------|------|
| GET | `/v1/admin/tenants` | - | `{ tenants }` | superadmin |
| POST | `/v1/admin/tenants` | `TenantCreate` | `{ tenant }` | superadmin |
| PATCH | `/v1/admin/tenants/:id` | `TenantUpdate` | `{ tenant }` | superadmin/admin |
| GET | `/v1/admin/tenants/:id/usage` | - | `{ usage }` | admin |

### User Admin Routes (`/v1/admin/users`)

| Method | Endpoint | Body | Response | Auth |
|--------|----------|------|----------|------|
| GET | `/v1/admin/users` | `?tenantId=...&limit=...` | `{ users }` | admin |
| GET | `/v1/admin/users/:id` | - | `{ user }` | admin |
| PATCH | `/v1/admin/users/:id` | `{ tier?, role? }` | `{ user }` | admin |
| DELETE | `/v1/admin/users/:id` | - | `{ success: true }` | admin |

---

## Key Improvements

### 1. Simpler Unified Chat Endpoint

**Current**: Multiple endpoints for different providers
```
/api/messages/ask (OpenAI)
/api/agents/:id/execute (Agents)
/api/assistants/:id/messages (Assistants)
```

**Target**: Single endpoint for everything
```typescript
POST /v1/chat
{
  messages: [...],
  agentId: "agent_abc123"  // OR
  model: "gpt-4"          // Direct model
}
// Handles routing internally
```

### 2. RESTful Design

**Current**: Inconsistent patterns
```
POST /api/convos/gen (generate title)
POST /api/messages/continue (continue message)
```

**Target**: REST conventions
```
PATCH /v1/conversations/:id (update title)
POST /v1/chat (continuation is just another message)
```

### 3. Versioning

**Current**: No versioning (breaking changes possible)

**Target**: `/v1/` prefix
```
/v1/chat     ← Current stable API
/v2/chat     ← Future breaking changes
/v1/chat     ← Still supported (deprecated)
```

### 4. Better Error Responses

**Current**:
```json
{ "error": "Something went wrong" }
```

**Target**:
```json
{
  "error": {
    "code": "INVALID_MODEL",
    "message": "Model 'gpt-5' not found",
    "details": {
      "availableModels": ["gpt-4", "gpt-4o"]
    }
  }
}
```

### 5. Consistent Pagination

**Current**: Mix of patterns
```
GET /api/convos?pageNumber=1&pageSize=10
GET /api/messages/:id?page=1&limit=20
```

**Target**: Cursor-based pagination
```
GET /v1/conversations?limit=20&cursor=abc123

Response:
{
  items: [...],
  nextCursor: "xyz789",
  hasMore: true
}
```

---

## Authentication Flow

### JWT + Refresh Token

**Login**:
```typescript
POST /v1/auth/login
Body: { email, password }

Response: {
  user: { id, email, name, tier },
  accessToken: "eyJ...",      // 15 min expiry
  refreshToken: "xyz...",     // 7 days expiry
  expiresAt: "2024-01-15T..."
}
```

**Authenticated Request**:
```typescript
GET /v1/conversations
Headers: {
  Authorization: "Bearer eyJ..."
}
```

**Refresh**:
```typescript
POST /v1/auth/refresh
Body: { refreshToken: "xyz..." }

Response: {
  accessToken: "eyJ...",
  expiresAt: "2024-01-15T..."
}
```

---

## Rate Limiting

**Current**: Basic rate limiting (express-rate-limit)

**Target**: Tier-based rate limits

| Endpoint | Free Tier | Pro Tier | Admin |
|----------|-----------|----------|-------|
| `/v1/chat` | 20/hour | 500/hour | Unlimited |
| `/v1/files/upload` | 10/day | 100/day | Unlimited |
| `/v1/rag/query` | 50/hour | 1000/hour | Unlimited |
| `/v1/memory` | 100/day | 1000/day | Unlimited |

**Headers**:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1705324800
```

---

## Webhook Support (New)

### Register Webhooks

```typescript
POST /v1/webhooks
Body: {
  url: "https://your-app.com/webhooks",
  events: ["conversation.created", "message.created"],
  secret: "your-webhook-secret"
}
```

### Events

| Event | Payload | When |
|-------|---------|------|
| `conversation.created` | `{ conversation }` | New conversation |
| `message.created` | `{ message, conversation }` | New message |
| `agent.executed` | `{ agentId, result }` | Agent completes |
| `file.embedded` | `{ fileId, chunks }` | RAG embedding done |

---

## Migration Path

### Phase 1: Dual API Support

Run both APIs in parallel:
- Old API: `https://api.soloos.ai/api/*` (current)
- New API: `https://api.soloos.ai/v1/*` (target)

### Phase 2: Gradual Migration

Feature flags to route requests:
```typescript
if (user.features.includes('use_v1_api')) {
  // Use new API
} else {
  // Use old API
}
```

### Phase 3: Deprecation

1. Add deprecation headers to old API
2. Give 3-month notice
3. Sunset old API

---

## Related Documentation

| Document | What It Covers | Read Next If... |
|----------|----------------|-----------------|
| **[Data Models](./data-models.md)** | What data these endpoints work with | You need to understand the schemas |
| **[Architecture](./architecture.md)** | How API integrates with system | You want system-level view |
| **[Features](./features.md)** | How features use these endpoints | You need feature context |
| **[Starter Integration](./starter-integration.md)** | Week-by-week API implementation | You're ready to build |
| **[Tech Stack](./tech-stack.md)** | Why Hono over Express | You want tech justification |

---

**This completes the comprehensive rebuild documentation!**

**Navigation**: Return to [README](./README.md) | Start Building: [Starter Integration](./starter-integration.md) | See All Docs: [.index](./.index)

