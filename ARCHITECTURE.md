# 🏗️ ShadFlareAi Architecture

**Last Updated:** November 6, 2025  
**State Management:** MobX  
**Auth:** Better Auth  
**Database:** Neon Postgres

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [State Management](#state-management)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)

---

## 🎯 Overview

ShadFlareAi is a modern full-stack application built on Cloudflare Workers with:
- **Reactive State Management** using MobX
- **Type-Safe Authentication** with Better Auth
- **Serverless Database** with Neon Postgres
- **Real-time Features** with WebSockets
- **AI Integration** with Cloudflare AI

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **TanStack Router** - Type-safe routing
- **MobX** - State management
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library

### Backend
- **Cloudflare Workers** - Serverless compute
- **Hono** - Web framework
- **Better Auth** - Authentication
- **Neon Postgres** - Database
- **Drizzle ORM** - Type-safe database access

### AI & Real-time
- **Cloudflare AI** - AI/ML capabilities
- **Durable Objects** - WebSocket connections
- **Workers AI** - LLM integration

---

## 📁 Project Structure

```
src/
├── stores/                    # MobX state management
│   ├── auth-mobx.ts          # Authentication store
│   ├── ai-chat-mobx.ts       # AI chat store
│   ├── config-mobx.ts        # App configuration store
│   ├── auth-simple.ts        # Better Auth integration
│   └── index.ts              # Store exports
│
├── hooks/                     # React hooks
│   ├── use-auth-mobx.ts      # Auth store hook
│   ├── use-ai-chat-mobx.ts   # Chat store hook
│   ├── use-config-mobx.ts    # Config store hook
│   └── ...
│
├── routes/                    # TanStack Router pages
│   ├── __root.tsx            # Root layout
│   ├── _authenticated/       # Protected routes
│   │   ├── ai-chat.tsx       # Main AI chat (local state)
│   │   ├── dashboard.tsx     # Dashboard
│   │   └── ...
│   └── (auth)/              # Auth routes
│       ├── sign-in.tsx
│       └── sign-up.tsx
│
├── components/               # React components
│   ├── ui/                  # Shadcn components
│   ├── layout/              # Layout components
│   └── ...
│
├── lib/                     # Utility libraries
│   ├── auth-client.ts       # Better Auth client
│   ├── logger.ts           # Logging utilities
│   └── ...
│
└── server/                  # Backend code
    ├── index.ts            # Main Hono app
    ├── routes/             # API routes
    ├── auth/               # Auth configuration
    └── durable-objects/    # WebSocket handlers
```

---

## 🔄 State Management (MobX)

### Core Stores

#### 1. **Auth Store** (`auth-mobx.ts`)
Manages authentication state and actions.

```typescript
class AuthStore {
  user: User | null = null
  session: Session | null = null
  isLoading = true
  error: Error | null = null
  
  // Computed
  get isAuthenticated() {
    return !!this.session && !!this.user
  }
  
  // Actions
  async signIn(email: string, password: string)
  async signUp(email: string, password: string, name: string)
  async signOut()
  async refreshSession()
}
```

#### 2. **AI Chat Store** (`ai-chat-mobx.ts`)
Manages chat messages, settings, and WebSocket state.

```typescript
class AIChatStore {
  messages: ChatMessage[] = []
  input = ''
  isStreaming = false
  settings: ChatSettings = { ... }
  websocket: WebSocketState = { ... }
  
  // Computed
  get messageCount()
  get canSendMessage()
  get hasMessages()
  
  // Actions
  addMessage(message)
  clearMessages()
  updateSettings(updates)
  sendMessage(content)
}
```

#### 3. **Config Store** (`config-mobx.ts`)
Manages global app configuration with localStorage persistence.

```typescript
class ConfigStore {
  theme: 'light' | 'dark' | 'system' = 'system'
  sidebarOpen = true
  sidebarCollapsed = false
  language = 'en'
  notifications = true
  
  // Actions with auto-persist
  setTheme(theme)
  toggleSidebar()
  setLanguage(language)
  reset()
}
```

### Usage in Components

All components using MobX state must be wrapped with `observer()`:

```typescript
import { observer } from 'mobx-react-lite'
import { useAIChatMobx } from '@/stores'

export const ChatComponent = observer(() => {
  const chat = useAIChatMobx()
  
  return (
    <div>
      <p>Messages: {chat.messageCount}</p>
      <button onClick={() => chat.clearMessages()}>
        Clear
      </button>
    </div>
  )
})
```

### Why MobX?

- ✅ **Battle-tested**: 10+ years in production
- ✅ **TypeScript**: Excellent type inference
- ✅ **Minimal boilerplate**: `makeAutoObservable()`
- ✅ **Familiar patterns**: Standard JavaScript classes
- ✅ **Great DevTools**: Excellent debugging support
- ✅ **Performance**: Automatic optimization with computed values

---

## 🔐 Authentication (Better Auth)

### Architecture

Better Auth provides:
- Email/password authentication
- Social OAuth (Google, GitHub)
- Session management with cookies
- Type-safe API

### Configuration

```typescript
// server/auth/config.ts
export function createAuth(env: Env) {
  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql, { schema })
  
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    emailAndPassword: { enabled: true },
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 }
    },
    socialProviders: {
      google: { ... },
      github: { ... }
    }
  })
}
```

### Client Usage

```typescript
import { authClient } from '@/lib/auth-client'

// Sign in
await authClient.signIn.email({ email, password })

// Sign up
await authClient.signUp.email({ email, password, name })

// Sign out
await authClient.signOut()

// Get session
const session = await authClient.getSession()
```

### Protected Routes

```typescript
import { AuthGuard } from '@/components/auth/auth-guard'

export const Route = createFileRoute('/_authenticated')({
  component: () => (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  )
})
```

---

## 🗄️ Database Schema (Neon Postgres)

### Multi-Tenant Design

All tables include `tenant_id` for multi-tenancy support:

```sql
-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Better Auth tables
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Connection

```typescript
// Direct connection (for Drizzle Kit)
DATABASE_URL=postgresql://user:pass@host/db

// Pooled connection (for application)
DATABASE_URL=postgresql://user:pass@host-pooler/db
```

---

## 🌐 API Routes

### Structure

```
/api
├── /auth/*              # Better Auth endpoints
├── /chat                # AI chat endpoint
├── /tasks               # CRUD for tasks
└── /users               # User management
```

### Example Route (Hono)

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.post('/api/chat', async (c) => {
  const { message } = await c.req.json()
  const user = c.get('user')
  
  // AI processing logic
  const response = await processAIMessage(message)
  
  return c.json({ response })
})
```

---

## 🚀 WebSockets (Durable Objects)

### AI Chat WebSocket

Handles real-time chat streaming:

```typescript
class AIChatWebSocket extends DurableObject {
  async handleWebSocketMessage(ws, message) {
    // Stream AI responses
    const stream = await this.streamAIResponse(message)
    for await (const chunk of stream) {
      ws.send(JSON.stringify({ type: 'chunk', data: chunk }))
    }
  }
}
```

### Voice AI WebSocket

Handles real-time voice conversations:

```typescript
class VoiceAIWebSocket extends DurableObject {
  async handleAudioStream(audioData) {
    // Process audio with Cloudflare AI
    const transcript = await this.transcribe(audioData)
    const response = await this.generateResponse(transcript)
    const audio = await this.synthesize(response)
    return audio
  }
}
```

---

## 📊 Performance & Optimization

### MobX Optimizations
- Computed values are memoized automatically
- Only components using changed observables re-render
- No manual `useMemo` or `useCallback` needed

### Cloudflare Edge
- Global deployment at 300+ locations
- Sub-50ms response times worldwide
- Automatic scaling

### Database
- Connection pooling for high throughput
- Prepared statements for performance
- Indexes on frequently queried columns

---

## 🧪 Development

### Local Development

```bash
# Frontend
npm run dev

# Backend
npx wrangler dev --port 8788

# Both (concurrently)
npm run dev
```

### Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:5173
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Set secrets
npx wrangler secret put DATABASE_URL
```

---

## 📚 Additional Resources

- [MobX Documentation](https://mobx.js.org/)
- [Better Auth Docs](https://www.better-auth.com/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Neon Postgres Docs](https://neon.tech/docs)
- [Migration Guide](./MOBX_MIGRATION_GUIDE.md)

---

## 🎯 Next Steps

1. **Enable Social Auth** - Add Google/GitHub OAuth
2. **Set Up Multi-tenancy** - Implement tenant isolation
3. **Add oRPC** - Auto-generate LLM tools from routes
4. **Integrate Composio** - Connect external services
5. **Implement RAG** - Use Vectorize for semantic search

---

**Built with ❤️ using Cloudflare Workers, MobX, and Better Auth**

