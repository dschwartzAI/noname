# Action Plan: Enhance Noname App with Next.js AI SDK Patterns

## ⚠️ IMPORTANT DISCOVERY

**Your `noname` app ALREADY uses Vercel AI SDK!** 

Based on recent commits (as of Nov 23, 2025):
- ✅ You're already using `useChat` hook
- ✅ You have AI streaming working
- ✅ You have tool calling implemented
- ✅ You have artifact creation

**What This Means**: You don't need to "integrate" the AI SDK - it's already there! Instead, this plan focuses on **enhancing your existing implementation** with specific patterns from the Next.js app that might improve your streaming behavior.

---

## Goal
Enhance your existing AI SDK implementation with specific patterns from this Next.js chatbot that make streaming smoother and more reliable.

**Timeline**: 3-5 days (not 1-2 weeks!)  
**Difficulty**: Low (fine-tuning existing code)  
**Impact**: Medium-High (polish and performance)

---

## Phase 1: Analysis (Day 1 - Morning)

### Step 1.1: Review Your Current Implementation

Since you already have AI SDK integrated, first understand what you have:

```bash
cd ~/noname
git checkout -b enhancement/improve-streaming-behavior

# Check your current AI SDK usage
grep -r "useChat" src/routes/
grep -r "streamText" server/routes/
grep -r "createUIMessageStream" server/
```

### Step 1.2: Compare with Next.js Patterns

Open both codebases side-by-side and compare:

**Your Current Setup** (based on commits):
- ✅ `src/routes/_authenticated/ai-chat/$conversationId.tsx` - Uses `useChat`
- ✅ `src/routes/_authenticated/ai-chat/index.tsx` - Chat interface
- ✅ Server routes with AI streaming (need to verify exact patterns)

**Next.js Reference Files** (this app):
1. `app/(chat)/api/chat/route.ts` - **Lines 222-355** - Streaming setup
2. `components/chat.tsx` - **Lines 79-132** - `useChat` configuration
3. `lib/ai/prompts.ts` - System prompt patterns
4. `lib/ai/tools/*.ts` - Tool definitions

### Step 1.3: Identify Specific Improvements Needed

Based on your original question ("can't quite get the AI chat behavior to function like the beautiful ai sdk behavior"), look for these specific differences:

1. **Streaming smoothness** - Do messages stream word-by-word smoothly?
2. **Tool execution** - Do tools work reliably without approval loops?
3. **Error handling** - Are errors handled gracefully?
4. **Message persistence** - Do messages save correctly during streaming?

---

## Phase 2: Backend Enhancements (Day 1-2)

### Step 2.1: Review Your Current Chat Route

**Location**: Check these files in your noname app:
- `server/routes/chat.ts` or `server/routes/chat-agent.ts`
- `src/server/` directory

**Current State**: You're already using AI SDK (confirmed from commits)
**Goal**: Compare with Next.js patterns to identify improvements

####Human: Ok, well what does this do for me then? 

Essentially just compare patterns and fix subtle issues?

```typescript
// noname/server/routes/chat.ts
import { Hono } from 'hono';
import { 
  streamText, 
  createUIMessageStream, 
  convertToModelMessages,
  smoothStream,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { conversationsTable, messagesTable, agentsTable } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '../auth/session';

type Bindings = {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  XAI_API_KEY?: string;
};

const chatRoutes = new Hono<{ Bindings: Bindings }>();
```

#### B. Replace Chat POST Route

Find your existing POST route (probably `/api/v1/chat` or similar) and replace with:

```typescript
chatRoutes.post('/', async (c) => {
  try {
    // 1. Get session (you already have this)
    const session = await getSession(c);
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // 2. Parse request (adapt to your schema)
    const { 
      conversationId, 
      message: userMessage,
      agentId,
    } = await c.req.json();

    // 3. Initialize DB (you already do this)
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 4. Get or create conversation
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!conversation) {
      await db.insert(conversationsTable).values({
        id: conversationId,
        userId: session.user.id,
        organizationId: session.user.activeOrganizationId,
        title: 'New Conversation',
        agentId: agentId || null,
      });
    }

    // 5. Fetch message history
    const previousMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    // 6. Convert to AI SDK format
    const uiMessages = [
      ...previousMessages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
      })),
      userMessage, // Should already be in parts format
    ];

    // 7. Save user message
    await db.insert(messagesTable).values({
      conversationId,
      role: 'user',
      content: userMessage.parts[0].text,
    });

    // 8. Get agent config (if using agents)
    let systemPrompt = 'You are a helpful AI assistant.';
    let selectedModel = 'claude-sonnet-4-20250514';
    
    if (agentId) {
      const [agent] = await db
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
      
      if (agent) {
        systemPrompt = agent.systemPrompt || systemPrompt;
        // You might have model preferences per agent
      }
    }

    // 9. 🎯 KEY PART - Create AI SDK stream
    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: anthropic(selectedModel, {
            apiKey: c.env.ANTHROPIC_API_KEY,
          }),
          system: systemPrompt,
          messages: convertToModelMessages(uiMessages),
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            // Add your tools here - we'll do this in Phase 3
          },
          onFinish: async ({ messages: newMessages, usage }) => {
            // Save assistant messages to DB
            for (const msg of newMessages) {
              if (msg.role === 'assistant') {
                const content = msg.parts
                  .filter(p => p.type === 'text')
                  .map(p => p.text)
                  .join('');
                
                await db.insert(messagesTable).values({
                  conversationId,
                  role: 'assistant',
                  content,
                });
              }
            }

            // Send usage data to frontend
            dataStream.write({
              type: 'data-usage',
              data: usage,
            });
          },
        });

        result.consumeStream();
        dataStream.merge(result.toUIMessageStream());
      },
      generateId: () => crypto.randomUUID(),
    });

    // 10. Return SSE stream
    return new Response(stream.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        // Convert to proper SSE format
        const text = new TextDecoder().decode(chunk);
        controller.enqueue(
          new TextEncoder().encode(`data: ${text}\n\n`)
        );
      }
    })), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default chatRoutes;
```

#### C. Test Backend

```bash
# Start your dev server
pnpm run dev

# Test with curl
curl -X POST http://localhost:8787/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-123",
    "message": {
      "id": "msg-1",
      "role": "user",
      "parts": [{"type": "text", "text": "Hello!"}]
    }
  }'
```

You should see SSE streaming! 🎉

---

## Phase 3: Frontend Integration (Day 2)

### Step 3.1: Update Chat Component

**Location**: `noname/src/routes/chat/$conversationId.tsx` (or wherever your chat page is)

#### A. Replace Custom Hook with `useChat`

**Current State**: You probably have custom state management
**Target State**: Use AI SDK's `useChat` hook

```typescript
// noname/src/routes/chat/$conversationId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';

export const Route = createFileRoute('/chat/$conversationId')({
  component: observer(ChatPage),
});

function ChatPage() {
  const { conversationId } = Route.useParams();
  const [currentModelId, setCurrentModelId] = useState('claude-sonnet-4');
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const currentModelIdRef = useRef(currentModelId);
  const currentAgentIdRef = useRef(currentAgentId);

  // Keep refs in sync
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentAgentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  // 🎯 KEY PART - Replace your custom hooks with useChat
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    input,
    setInput,
  } = useChat({
    id: conversationId,
    messages: [], // Load initial messages from DB in a loader
    experimental_throttle: 100,
    generateId: () => crypto.randomUUID(),
    transport: new DefaultChatTransport({
      api: '/api/v1/chat', // Your Hono endpoint
      fetch: async (url, options) => {
        const response = await fetch(url, {
          ...options,
          credentials: 'include', // Important for Better Auth
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response;
      },
      prepareSendMessagesRequest(request) {
        return {
          body: {
            conversationId: request.id,
            message: request.messages.at(-1),
            agentId: currentAgentIdRef.current,
            modelId: currentModelIdRef.current,
          },
        };
      },
    }),
    onData: (dataPart) => {
      // Handle custom data events
      if (dataPart.type === 'data-usage') {
        console.log('Usage:', dataPart.data);
        // Update usage display
      }
    },
    onFinish: () => {
      console.log('Stream finished');
      // Refresh conversation list if needed
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Show toast notification
    },
  });

  return (
    <div className="flex h-screen flex-col">
      {/* Your existing header */}
      <div className="flex-shrink-0 border-b p-4">
        <h1>Chat</h1>
        {/* Model selector, agent selector, etc. */}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <MessageList 
          messages={messages}
          status={status}
        />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t p-4">
        <MessageInput
          input={input}
          setInput={setInput}
          onSend={(content) => {
            sendMessage({
              role: 'user',
              parts: [{ type: 'text', text: content }],
            });
          }}
          isStreaming={status === 'streaming'}
          onStop={stop}
        />
      </div>
    </div>
  );
}
```

#### B. Update Message Display Component

Your existing message components should mostly work! Just ensure they handle the `parts` format:

```typescript
// noname/src/components/chat/message-list.tsx
import { observer } from 'mobx-react-lite';
import type { Message } from '@ai-sdk/react';

interface MessageListProps {
  messages: Message[];
  status: 'idle' | 'streaming' | 'loading';
}

export const MessageList = observer(({ messages, status }: MessageListProps) => {
  return (
    <div className="space-y-4 p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg p-4 ${
            message.role === 'user' 
              ? 'bg-blue-100 ml-12' 
              : 'bg-gray-100 mr-12'
          }`}
        >
          <div className="font-semibold mb-1">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div>
            {message.parts.map((part, i) => (
              <div key={i}>
                {part.type === 'text' && (
                  <div className="prose prose-sm max-w-none">
                    {part.text}
                  </div>
                )}
                {part.type === 'tool-call' && (
                  <div className="text-sm text-gray-500">
                    Calling tool: {part.toolName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {status === 'streaming' && (
        <div className="text-gray-400 text-sm">
          Assistant is typing...
        </div>
      )}
    </div>
  );
});
```

### Step 3.2: Test Frontend

```bash
# Start dev server
pnpm run dev

# Open browser to http://localhost:5173/chat/new-id
# Type a message
# Watch it stream word-by-word! 🎉
```

---

## Phase 4: Add Tools (Day 3-4)

### Step 4.1: Port Tool Definitions

Copy tool patterns from this Next.js app. Here's an example:

```typescript
// noname/server/tools/create-document.ts
import { tool } from 'ai';
import { z } from 'zod';

export function createDocumentTool({ session, dataStream, db }: any) {
  return tool({
    description: 'Create a new document/artifact',
    parameters: z.object({
      title: z.string().describe('Title of the document'),
    }),
    execute: async ({ title }) => {
      // Create document in DB
      const [doc] = await db.insert(documentsTable).values({
        title,
        kind: 'text',
        userId: session.user.id,
      }).returning();

      // Send to frontend
      dataStream.write({
        type: 'data-document-created',
        data: doc,
      });

      return `Created document: ${title}`;
    },
  });
}
```

### Step 4.2: Register Tools in Chat Route

```typescript
// Back in noname/server/routes/chat.ts
import { createDocumentTool } from '../tools/create-document';
import { getWeatherTool } from '../tools/get-weather';

// Inside your streamText call:
tools: {
  createDocument: createDocumentTool({ session, dataStream, db }),
  getWeather: getWeatherTool(),
  // Add more tools...
},
experimental_activeTools: ['createDocument', 'getWeather'],
```

---

## Phase 5: Add Artifacts/Documents (Day 5-7)

### Step 5.1: Copy Artifact Components

Reference files from Next.js app:
- `components/artifact.tsx` - Main artifact panel
- `artifacts/text/server.ts` - Text document handler
- `artifacts/code/server.ts` - Code artifact handler

### Step 5.2: Integrate into Your App

Add artifact panel to your chat layout:

```typescript
// noname/src/routes/chat/$conversationId.tsx
import { Artifact } from '@/components/artifact';

function ChatPage() {
  // ... existing useChat setup ...

  return (
    <div className="flex h-screen">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* ... existing chat UI ... */}
      </div>

      {/* Artifact panel (shows when active) */}
      <Artifact
        conversationId={conversationId}
        messages={messages}
      />
    </div>
  );
}
```

---

## Phase 6: Polish & Deploy (Week 2)

### Step 6.1: Add Loading States

```typescript
{status === 'loading' && <LoadingSpinner />}
{status === 'streaming' && <StreamingIndicator />}
```

### Step 6.2: Add Error Handling

```typescript
onError: (error) => {
  toast.error('Failed to send message');
  console.error(error);
}
```

### Step 6.3: Add Message Regeneration

```typescript
<button onClick={() => regenerate()}>
  Regenerate
</button>
```

### Step 6.4: Test Thoroughly

- [ ] Send messages
- [ ] Verify streaming works
- [ ] Test tool calling
- [ ] Test artifacts
- [ ] Test error cases
- [ ] Test on mobile

### Step 6.5: Deploy

```bash
git add .
git commit -m "feat: integrate AI SDK for improved streaming"
git push origin feature/ai-sdk-integration

# Deploy to staging
wrangler deploy --env staging

# Test on staging
# If good, deploy to production
wrangler deploy
```

---

## Checklist

### Backend (Day 1)
- [ ] Install AI SDK packages
- [ ] Replace chat route with `createUIMessageStream`
- [ ] Test streaming with curl
- [ ] Verify messages save to DB

### Frontend (Day 2)
- [ ] Replace custom hooks with `useChat`
- [ ] Update message display components
- [ ] Test streaming in browser
- [ ] Verify word-by-word streaming works

### Tools (Day 3-4)
- [ ] Port tool definitions from Next.js app
- [ ] Register tools in chat route
- [ ] Test tool calling
- [ ] Verify tool results display

### Artifacts (Day 5-7)
- [ ] Copy artifact components
- [ ] Integrate artifact panel
- [ ] Test document creation
- [ ] Test document updates

### Polish (Week 2)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add regeneration
- [ ] Test all features
- [ ] Deploy to production

---

## Key Files to Reference

From this Next.js app, keep these files handy:

### Backend Patterns
1. **`app/(chat)/api/chat/route.ts`** 
   - Lines 222-355: The core streaming setup
   - This is your gold standard

2. **`lib/ai/providers.ts`**
   - Model configuration
   - Provider setup

3. **`lib/ai/tools/*.ts`**
   - Tool definitions
   - Tool execution patterns

### Frontend Patterns
4. **`components/chat.tsx`**
   - Lines 79-132: `useChat` hook usage
   - Lines 92-107: Transport configuration

5. **`components/messages.tsx`**
   - Message display logic
   - Streaming indicators

6. **`components/artifact.tsx`**
   - Artifact panel layout
   - Document management

---

## Expected Results

### Before Integration
- ⚠️ Chat streaming might be choppy
- ⚠️ Custom state management complexity
- ⚠️ Manual SSE parsing

### After Integration
- ✅ Smooth word-by-word streaming
- ✅ Elegant tool calling
- ✅ Better error handling
- ✅ Easier to add new features
- ✅ Same UX as Next.js app

---

## Troubleshooting

### Streaming Not Working
**Check**:
1. SSE headers correct? (`text/event-stream`)
2. CORS configured? (credentials: 'include')
3. Data format correct? (AI SDK expects specific format)

**Debug**:
```bash
# Check network tab in browser
# Look for SSE connection
# Verify data format
```

### Messages Not Saving
**Check**:
1. DB connection working?
2. `onFinish` callback executing?
3. Schema matches your DB?

### Tool Calls Failing
**Check**:
1. Tool schema defined correctly?
2. `experimental_activeTools` includes tool name?
3. Tool execute function returns something?

---

## Success Criteria

You'll know it's working when:
1. ✅ Messages stream word-by-word
2. ✅ No choppy streaming
3. ✅ Tools execute properly
4. ✅ Artifacts create and update
5. ✅ Error handling works
6. ✅ Matches Next.js app quality

---

## Next Steps After Integration

Once this works, you can:
1. Add reasoning mode (extended thinking)
2. Add multi-modal inputs (images, files)
3. Add more AI models
4. Add voice input/output
5. Add conversation branching

---

## Time Estimates

- **Phase 1 (Setup)**: 1 hour
- **Phase 2 (Backend)**: 4 hours
- **Phase 3 (Frontend)**: 4 hours
- **Phase 4 (Tools)**: 1 day
- **Phase 5 (Artifacts)**: 2-3 days
- **Phase 6 (Polish)**: 2-3 days

**Total**: 1-2 weeks of focused work

---

## Support

**Stuck?**
1. Check the Next.js app code
2. Review [AI SDK docs](https://sdk.vercel.ai/docs)
3. Check your noname app's existing patterns
4. Compare side-by-side with Next.js implementation

**Ready to start?** Begin with Phase 1! 🚀

