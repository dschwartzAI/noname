Migration Plan: Current System → Cloudflare Agents SDK
Project: ShadFlareAi Agent Builder
Goal: Migrate from HTTP streaming to Cloudflare Agents SDK with Durable Objects
Timeline: 2-3 days
Status: Ready to execute

Executive Summary
We're migrating from a custom HTTP streaming chat system to Cloudflare's official Agents SDK. This gives us:

Proper Durable Object usage - State management built-in
WebSocket state syncing - Real-time updates with useAgent hook
Official framework - Battle-tested patterns from Cloudflare
Simplified architecture - Less custom code, more framework


Current vs. Target Architecture
Current (Broken)
Frontend: useChat → POST /api/v1/chat (HTTP streaming)
Backend: Manual agent loop in chat.ts
State: PostgreSQL only
Tools: Custom implementation
Artifacts: Broken persistence
DOs: Configured but unused
Target (Cloudflare Agents SDK)
Frontend: useAgent (from Agents SDK) → WebSocket → Durable Object
Backend: Agent class extends Agent<Env, State>
State: DO storage + PostgreSQL
Tools: Agents SDK tool pattern
Artifacts: Persisted in DO state
DOs: Core execution layer

Phase 1: Setup & Dependencies (30 mins)
1.1 Install Agents SDK
bashnpm install agents
1.2 Study Reference Implementation
Clone the starter for reference:
bashgit clone https://github.com/cloudflare/agents-starter reference-agents-starter
Key files to review:

reference-agents-starter/src/server.ts - Agent class structure
reference-agents-starter/src/app.tsx - Frontend useAgent usage
reference-agents-starter/src/tools.ts - Tool definition pattern

1.3 Update wrangler.toml
Current DO binding:
toml[[durable_objects.bindings]]
name = "AI_CHAT_WEBSOCKET"
class_name = "AIChatWebSocketDO"
Change to Agents SDK pattern:
toml[[durable_objects.bindings]]
name = "AGENTS"
class_name = "Agent"
script_name = "shadcn-admin-cf-ai"

Phase 2: Backend Migration (4-6 hours)
2.1 Create Agent Base Class
File: src/server/agents/base-agent.ts
typescriptimport { Agent, callable } from 'agents';
import type { Env } from '../types';

// Agent state structure
interface AgentState {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: any[];
    toolResults?: any[];
  }>;
  artifacts: Map<string, {
    title: string;
    kind: string;
    content: string;
    language?: string;
  }>;
  memory: string[];
}

export class CustomGPTAgent extends Agent<Env, AgentState> {
  // Agent configuration from DB
  private agentConfig: {
    id: string;
    name: string;
    instructions: string;
    model: string;
    tools: string[];
  } | null = null;

  // Initialize agent
  async onStart() {
    // Load agent config from database
    const agentId = this.state.agentId || this.name;
    this.agentConfig = await this.loadAgentFromDB(agentId);
    
    // Initialize state if needed
    if (!this.state.messages) {
      await this.setState({
        conversationId: '',
        messages: [],
        artifacts: new Map(),
        memory: []
      });
    }
  }

  // Load agent configuration from Neon Postgres
  private async loadAgentFromDB(agentId: string) {
    const db = drizzle(this.env.DATABASE_URL);
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId)
    });
    return agent;
  }

  // Callable method: Send message to agent
  @callable()
  async chat(message: string, conversationId: string) {
    // Add user message to state
    await this.setState({
      ...this.state,
      conversationId,
      messages: [
        ...this.state.messages,
        { role: 'user', content: message }
      ]
    });

    // Load tools based on agent config
    const tools = this.buildTools();

    // Stream response using Vercel AI SDK
    const result = await streamText({
      model: this.getModel(),
      messages: this.state.messages,
      system: this.agentConfig?.instructions,
      tools,
      maxSteps: 5,
      onStepFinish: async (step) => {
        // Handle tool calls, persist to state
        if (step.toolCalls) {
          await this.handleToolCalls(step);
        }
      }
    });

    // Return streaming response
    return result.toDataStreamResponse();
  }

  // Build tools based on agent configuration
  private buildTools() {
    const enabledTools = this.agentConfig?.tools || [];
    const tools: any = {};

    if (enabledTools.includes('rag')) {
      tools.searchKnowledge = this.createRAGTool();
    }

    if (enabledTools.includes('memory')) {
      tools.queryMemory = this.createMemoryTool();
    }

    if (enabledTools.includes('createDocument')) {
      tools.createDocument = this.createArtifactTool();
    }

    return tools;
  }

  // RAG tool implementation
  private createRAGTool() {
    return tool({
      description: 'Search the knowledge base for relevant information',
      parameters: z.object({
        query: z.string().describe('Search query')
      }),
      execute: async ({ query }) => {
        // Use existing Cloudflare AI Search
        const results = await this.env.AI_SEARCH.search(query, {
          // ... your existing RAG logic
        });
        return results;
      }
    });
  }

  // Memory tool implementation
  private createMemoryTool() {
    return tool({
      description: 'Recall information from past conversations',
      parameters: z.object({
        query: z.string()
      }),
      execute: async ({ query }) => {
        // Use existing memory system
        return this.state.memory;
      }
    });
  }

  // Artifact creation tool
  private createArtifactTool() {
    return tool({
      description: 'Create a document artifact',
      parameters: z.object({
        title: z.string(),
        kind: z.string(),
        content: z.string(),
        language: z.string().optional()
      }),
      execute: async (artifact) => {
        // Store in DO state
        const artifacts = new Map(this.state.artifacts);
        artifacts.set(artifact.title, artifact);
        
        await this.setState({
          ...this.state,
          artifacts
        });

        return { success: true, artifact };
      }
    });
  }

  // Get model based on agent config
  private getModel() {
    const modelName = this.agentConfig?.model || 'gpt-4o';
    return getModel(this.env, modelName);
  }

  // Handle tool calls
  private async handleToolCalls(step: any) {
    // Tool execution already handled by AI SDK
    // Just persist to state and DB
    await this.saveStepToDB(step);
  }

  // Save conversation step to database
  private async saveStepToDB(step: any) {
    const db = drizzle(this.env.DATABASE_URL);
    // ... your existing persistence logic
  }
}
2.2 Update Worker Entry Point
File: src/index.ts
Replace current chat routes with Agent routing:
typescriptimport { CustomGPTAgent } from './server/agents/base-agent';

export { CustomGPTAgent as Agent };

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Route to specific agent instance
    if (url.pathname.startsWith('/agent/')) {
      const agentId = url.pathname.split('/')[2];
      const doId = env.AGENTS.idFromName(agentId);
      const stub = env.AGENTS.get(doId);
      return stub.fetch(request);
    }

    // ... rest of your routes
  }
};
2.3 Migrate Existing Tools
Map current tools to Agent SDK pattern:
Current ToolMigration PathqueryMemories→ createMemoryTool() in base agentcreateDocument→ createArtifactTool() in base agentRAG search→ createRAGTool() in base agent

Phase 3: Frontend Migration (2-3 hours)
3.1 Install Agent SDK React Package
bashnpm install agents @cloudflare/agents-react
3.2 Replace useChat with useAgent
File: src/routes/_authenticated/ai-chat/$conversationId.tsx
Current:
typescriptconst { messages, append, isLoading } = useChat({
  api: '/api/v1/chat',
  // ...
});
New:
typescriptimport { useAgent } from '@cloudflare/agents-react';

const { messages, state, send, isLoading } = useAgent({
  agentUrl: `/agent/${agentId}`,
  conversationId,
  onStateChange: (newState) => {
    // State automatically synced from DO
    // Artifacts available in newState.artifacts
    setArtifacts(newState.artifacts);
  }
});

// Send message
const handleSend = (message: string) => {
  send('chat', message, conversationId);
};
3.3 Update Artifacts Rendering
Artifacts now come from DO state:
typescript// Access artifacts from agent state (auto-synced)
const artifacts = state?.artifacts || new Map();

// Render artifacts
{Array.from(artifacts.values()).map(artifact => (
  <ArtifactViewer
    key={artifact.title}
    artifact={artifact}
  />
))}
3.4 Update New Chat Flow
File: src/routes/_authenticated/ai-chat/index.tsx
typescriptconst handleFirstMessage = async (message: string) => {
  // Create conversation in DB first
  const conversation = await createConversation({
    agentId: selectedAgentId,
    userId,
    organizationId
  });

  // Navigate to conversation page
  // useAgent will connect to the DO automatically
  navigate(`/ai-chat/${conversation.id}`);
};

Phase 4: Database Integration (1-2 hours)
4.1 Sync DO State to PostgreSQL
In base agent class:
typescriptprivate async syncToDB() {
  const db = drizzle(this.env.DATABASE_URL);
  
  // Save conversation
  await db.insert(conversations).values({
    id: this.state.conversationId,
    // ...
  }).onConflictDoUpdate();

  // Save messages
  for (const msg of this.state.messages) {
    await db.insert(messages).values({
      conversationId: this.state.conversationId,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolResults: msg.toolResults
    });
  }
}
4.2 Load Conversation History into DO
typescriptasync loadConversation(conversationId: string) {
  const db = drizzle(this.env.DATABASE_URL);
  
  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: asc(messages.createdAt)
  });

  await this.setState({
    ...this.state,
    conversationId,
    messages: msgs
  });
}

Phase 5: Remove Dead Code (30 mins)
5.1 Delete Unused Files
bashrm src/server/ai-chat-websocket.ts
rm src/workflows/agent-loop.ts
rm src/server/routes/chat.ts
5.2 Remove from wrangler.toml
Delete:
toml[[workflows]]
binding = "AGENT_LOOP_WORKFLOW"
name = "agent-loop"
class_name = "AgentLoopWorkflow"
5.3 Clean up imports
Remove references to:

AI_CHAT_WEBSOCKET binding
AGENT_LOOP_WORKFLOW binding
Custom HTTP chat routes


Phase 6: Testing & Validation (2-3 hours)
6.1 Local Testing
bashnpx wrangler dev
Test scenarios:

Create new agent in UI
Start new chat with agent
Send message → verify response streams
Use RAG tool → verify search works
Create artifact → verify it persists
Reload page → verify artifacts still there
Check Postgres → verify messages saved

6.2 Deploy to Production
bashnpx wrangler deploy
6.3 Production Validation

Test multi-tenant isolation
Verify agent configs load correctly
Check WebSocket connections stable
Monitor DO performance


Success Criteria
✅ Chat works end-to-end - Message → Response → Persisted
✅ Artifacts persist - Create → Reload → Still visible
✅ Tools execute - RAG, Memory, Document creation all work
✅ State syncs - DO state matches PostgreSQL
✅ Multi-tenant secure - Org A can't see Org B's agents
✅ No dead code - Old HTTP routes removed
✅ WebSocket stable - useAgent hook maintains connection

Rollback Plan
If migration fails:

Revert wrangler.toml to previous DO binding
Restore src/server/routes/chat.ts
Revert frontend to useChat
Deploy: npx wrangler deploy

Keep old code in a backup/ folder until migration validated.

Reference Documentation
Cloudflare Agents SDK:

Agents Docs
Starter Template
Announcement Blog

Durable Objects:

What are Durable Objects
DO Best Practices


Implementation Order
Day 1:

Phase 1: Setup (30 mins)
Phase 2: Backend (4-6 hours)
Phase 4.1: Basic DB sync (1 hour)

Day 2:

Phase 3: Frontend (2-3 hours)
Phase 4.2: History loading (1 hour)
Phase 5: Cleanup (30 mins)

Day 3:

Phase 6: Testing (2-3 hours)
Deploy to production
Monitor & validate


Critical Notes for Cursor Agent

Don't try to use both systems - Remove old chat routes completely
DO state is primary - PostgreSQL is backup/history only
Tools must use Agent SDK pattern - Use tool() helper from AI SDK
State syncing is automatic - Don't manually broadcast over WebSocket
One DO per conversation - Use conversationId as DO name
Agent config from DB - Load in onStart(), cache in DO


Questions to Resolve During Implementation

DO lifecycle: Create on first message or pre-create when agent selected?
State size: Trim old messages if state > 1MB?
Tool failures: Retry in DO or let frontend handle?
Concurrent users: One DO per conversation or per user+conversation?

Recommend: Start with one DO per conversation, optimize later if needed.
