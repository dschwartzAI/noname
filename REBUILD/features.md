# Complete Feature Inventory

> **Related Docs**: [Architecture](./architecture.md) | [Tech Stack](./tech-stack.md) | [Migration Plan](./migration-plan.md) | [Data Models](./data-models.md) | [API Endpoints](./api-endpoints.md)

## Overview

This document catalogs **every feature** in the current LibreChat fork, shows **how it's implemented**, and provides **code-level migration strategies** to the new stack (ShadFlareAi + Vercel AI SDK + Composio).

**Navigation**:
- 📋 [Features Overview](#overview)
- 💬 [Chat Interface](#1-chat-interface) → See [Architecture: Data Flow](./architecture.md#data-flow-user-message--ai-response-target)
- 🤖 [AI Agents](#2-ai-agents) → See [Architecture: oRPC](./architecture.md#orpc-architecture)
- 🎨 [Artifacts](#3-artifacts-interactive-content) → See [Starter Integration: Week 5-6](./starter-integration.md#week-5-6-agent-migration)
- 📁 [RAG System](#4-rag-file-upload--search) → See [Architecture: RAG Flow](./architecture.md#rag-data-flow-target---built-in-pgvector)
- 🎓 [LMS Features](#5-lms-features) → See [Data Models: LMS Tables](./data-models.md#lms-tables)
- 🧠 [Memory System](#6-memory-system) → See [API Endpoints: Memory Routes](./api-endpoints.md#memory-routes-v1memory)

---

## 1. Chat Interface

### 1.1 Core Chat UI

**Current Implementation:**

```tsx
// client/src/components/Chat/ChatView.tsx
export function ChatView() {
  const { conversation } = useRecoilValue(conversationAtom);
  const [messages, setMessages] = useRecoilState(messagesAtom);
  
  return (
    <div className="chat-container">
      <MessagesView messages={messages} />
      <MessageInput onSubmit={handleSubmit} />
    </div>
  );
}

// Uses Recoil for state, custom SSE parsing
```

**Key Features:**
- Streaming responses via Server-Sent Events (SSE)
- Message branching (multiple conversation paths)
- Regenerate responses
- Edit previous messages
- Copy message content
- Stop generation mid-stream

**Migration to Vercel AI SDK:**

> **See**: [Architecture: Target System](./architecture.md#target-system-architecture-shadflareai--neon--orpc) for full context

```tsx
// src/routes/chat/$conversationId.tsx (NEW)
import { useChat } from 'ai/react';

export function ChatRoute() {
  const { conversationId } = useParams();
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/v1/chat',
    body: { conversationId },
    onFinish: (message) => {
      // Auto-save to database (handled by API)
    }
  });
  
  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={messages} />
      <MessageInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </div>
  );
}
```

**Benefits of Migration:**
- ✅ Built-in streaming (no custom SSE parsing)
- ✅ Automatic optimistic updates
- ✅ Error handling included
- ✅ 90% less code

### 1.2 Message Rendering

**Current Implementation:**

```tsx
// client/src/components/Chat/Messages/MessageRender.tsx
export function MessageRender({ message }) {
  const isUser = message.isCreatedByUser;
  
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <Avatar user={isUser ? user : agent} />
      <MessageContent content={message.text} />
      {message.plugins && <PluginDisplay plugins={message.plugins} />}
    </div>
  );
}
```

**Features:**
- Markdown rendering with syntax highlighting
- Code block copy buttons
- LaTeX math rendering
- Inline citations
- Tool/plugin result display

**Migration with Vercel AI Elements:**

```tsx
// src/components/chat/message-list.tsx (NEW)
import { Message, Artifact } from '@ai-sdk/ui-elements';

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-4 p-4">
      {messages.map((message) => (
        <Message
          key={message.id}
          role={message.role}
          content={message.content}
          
          // Built-in markdown, code highlighting, LaTeX
          renderMarkdown={true}
          
          // Tool calls automatically formatted
          toolInvocations={message.toolInvocations}
          
          // Custom styling
          className="message-bubble"
        >
          {/* Artifacts (code, charts, etc.) */}
          {message.experimental_attachments?.map((attachment) => (
            <Artifact
              key={attachment.name}
              name={attachment.name}
              content={attachment.content}
              language={attachment.contentType}
            />
          ))}
        </Message>
      ))}
    </div>
  );
}
```

**Vercel AI Elements Features:**
- ✅ Pre-styled markdown rendering
- ✅ Syntax highlighting out-of-box
- ✅ Interactive artifacts (see below)
- ✅ Tool invocation display
- ✅ Responsive design

### 1.3 Conversation Branching

**Current Implementation:**

```javascript
// api/models/Message.js
const messageSchema = new Schema({
  parentMessageId: String,
  children: [String],  // Array of child message IDs
  conversationId: String
});

// Allows user to branch from any message
```

**Migration to Neon:**

```typescript
// database/schema/messages.ts
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  parentId: uuid('parent_id').references(() => messages.id),  // Self-reference!
  content: text('content').notNull(),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Query for conversation tree
export async function getConversationTree(conversationId: string) {
  const db = getDb();
  
  // Recursive CTE to build tree
  const tree = await db.execute(sql`
    WITH RECURSIVE message_tree AS (
      SELECT *, 1 as depth
      FROM ${messages}
      WHERE conversation_id = ${conversationId} AND parent_id IS NULL
      
      UNION ALL
      
      SELECT m.*, mt.depth + 1
      FROM ${messages} m
      JOIN message_tree mt ON m.parent_id = mt.id
    )
    SELECT * FROM message_tree ORDER BY depth, created_at
  `);
  
  return tree;
}
```

---

## 2. AI Agents

### 2.1 Agent Builder

> **Cross-ref**: 
> - [Architecture: oRPC Integration](./architecture.md#orpc-architecture)
> - [Data Models: agents table](./data-models.md#agents)
> - [API Endpoints: Agent Routes](./api-endpoints.md#agent-routes-v1agents)

**Current Implementation:**

```tsx
// client/src/components/Endpoints/AgentSettings.tsx
export function AgentSettings() {
  const [agent, setAgent] = useState({
    name: '',
    instructions: '',
    model: 'gpt-4',
    tools: []
  });
  
  return (
    <form onSubmit={createAgent}>
      <Input name="name" />
      <Textarea name="instructions" />
      <Select name="model" options={models} />
      <ToolSelector selected={agent.tools} onChange={setTools} />
    </form>
  );
}
```

**Features:**
- Visual agent builder
- Tool selection (file_search, web_search, etc.)
- Model selection per agent
- Custom instructions
- Temperature/parameter tuning

**Migration with oRPC + Composio:**

```tsx
// src/routes/agents/new.tsx (NEW)
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function AgentBuilderRoute() {
  const [agent, setAgent] = useState({
    name: '',
    instructions: '',
    model: 'gpt-4o',
    tools: []
  });
  
  // Get available tools (oRPC auto-generated + Composio)
  const { data: availableTools } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await fetch('/api/tools/list');
      return res.json();
    }
  });
  
  // Categorized tools
  const internalTools = availableTools?.orpc || [];  // Your API endpoints
  const externalTools = availableTools?.composio || [];  // GitHub, Gmail, etc.
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Agent</h1>
      
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <Label>Agent Name</Label>
          <Input
            value={agent.name}
            onChange={(e) => setAgent({ ...agent, name: e.target.value })}
            placeholder="Marketing Assistant"
          />
        </div>
        
        <div>
          <Label>Instructions</Label>
          <Textarea
            value={agent.instructions}
            onChange={(e) => setAgent({ ...agent, instructions: e.target.value })}
            placeholder="You are a marketing expert..."
            rows={10}
          />
        </div>
        
        <div>
          <Label>Model</Label>
          <Select
            value={agent.model}
            onValueChange={(model) => setAgent({ ...agent, model })}
          >
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
          </Select>
        </div>
      </div>
      
      {/* Internal Tools (oRPC) */}
      <div className="space-y-2">
        <h3 className="font-semibold">Internal Tools</h3>
        <p className="text-sm text-muted-foreground">
          Auto-generated from your API endpoints
        </p>
        {internalTools.map((tool) => (
          <div key={tool.name} className="flex items-center space-x-2">
            <Checkbox
              checked={agent.tools.includes(tool.name)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setAgent({ ...agent, tools: [...agent.tools, tool.name] });
                } else {
                  setAgent({
                    ...agent,
                    tools: agent.tools.filter(t => t !== tool.name)
                  });
                }
              }}
            />
            <Label className="font-mono text-sm">{tool.name}</Label>
            <span className="text-xs text-muted-foreground">{tool.description}</span>
          </div>
        ))}
      </div>
      
      {/* External Tools (Composio) */}
      <div className="space-y-2">
        <h3 className="font-semibold">External Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Connect to GitHub, Gmail, Calendar, etc.
        </p>
        {externalTools.map((tool) => (
          <div key={tool.name} className="flex items-center space-x-2">
            <Checkbox
              checked={agent.tools.includes(tool.name)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setAgent({ ...agent, tools: [...agent.tools, tool.name] });
                }
              }}
            />
            <Label>{tool.name}</Label>
            <Badge variant="outline">{tool.category}</Badge>
          </div>
        ))}
      </div>
      
      <Button onClick={createAgent}>Create Agent</Button>
    </div>
  );
}
```

### 2.2 Agent Execution

**Current Implementation:**

```javascript
// api/server/services/Endpoints/agents/initialize.js
async function initializeAgent(req, agentId) {
  const agent = await Agent.findOne({ id: agentId });
  
  // Load tools
  const tools = await loadTools(agent.tools);
  
  // Create Langchain agent
  const executor = AgentExecutor.fromAgentAndTools({
    agent: createAgent(agent.model, agent.instructions),
    tools,
    memory: new BufferMemory()
  });
  
  return executor;
}
```

**Migration with Vercel AI SDK:**

```typescript
// server/services/ai/agent-executor.ts (NEW)
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function executeAgent(
  agentId: string,
  messages: Message[],
  tenantId: string
) {
  const db = getDb();
  
  // Load agent
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.tenantId, tenantId))
  });
  
  // Get oRPC tools (auto-generated)
  const orpcTools = await generateToolsFromRoutes({
    include: ['/api/users/*', '/api/memory/*', '/api/files/*']
  });
  
  // Get Composio tools
  const composioTools = await getComposioTools(agent.userId, [
    'GITHUB_CREATE_ISSUE',
    'GMAIL_SEND',
    'GCAL_CREATE_EVENT'
  ]);
  
  // Filter to agent's allowed tools
  const allowedTools = [...orpcTools, ...composioTools].filter(t =>
    agent.tools.includes(t.name)
  );
  
  // Execute with streaming
  const result = streamText({
    model: openai(agent.model),
    messages,
    tools: allowedTools,
    system: agent.instructions,
    maxSteps: 10,  // Multi-step tool use
    onStepFinish: (step) => {
      console.log('Step finished:', step);
    }
  });
  
  return result;
}
```

**Key Improvement:** No Langchain needed! Vercel AI SDK handles:
- Tool calling
- Multi-step reasoning
- Error recovery
- Streaming

---

## 3. Artifacts (Interactive Content)

### 3.1 Current Implementation (Minimal)

**Current:** LibreChat has basic artifact support through custom message rendering, but it's limited.

### 3.2 Target: Full Artifact System

> **Cross-ref**: [Starter Integration: Artifact Implementation](./starter-integration.md#week-9-10-rag-with-pgvector)

**What are Artifacts?**
Interactive content generated by AI:
- Code snippets (runnable)
- Mermaid diagrams
- SVG graphics
- React components
- HTML pages
- CSV data → tables

**Implementation with Vercel AI SDK:**

```tsx
// src/components/chat/artifact-viewer.tsx (NEW)
import { Artifact } from '@ai-sdk/ui-elements';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

export function ArtifactViewer({ artifact }: { artifact: Attachment }) {
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'deployed'>('idle');
  
  const handleDeployToVercel = async () => {
    setDeployStatus('deploying');
    
    // Deploy to Vercel
    const res = await fetch('/api/artifacts/deploy', {
      method: 'POST',
      body: JSON.stringify({
        name: artifact.name,
        code: artifact.content,
        type: artifact.contentType
      })
    });
    
    const { url } = await res.json();
    setDeployStatus('deployed');
    window.open(url, '_blank');
  };
  
  const handlePushToGoogleDocs = async () => {
    await fetch('/api/artifacts/export/google-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: artifact.name,
        content: artifact.content
      })
    });
  };
  
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{artifact.name}</h3>
        
        <div className="flex gap-2">
          {/* Export Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handlePushToGoogleDocs}>
                <FileText className="w-4 h-4 mr-2" />
                Google Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsFile(artifact)}>
                <Download className="w-4 h-4 mr-2" />
                Download File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyToClipboard(artifact.content)}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Deploy to Vercel */}
          {artifact.contentType === 'code/html' && (
            <Button
              size="sm"
              onClick={handleDeployToVercel}
              disabled={deployStatus === 'deploying'}
            >
              {deployStatus === 'deploying' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deployStatus === 'deployed' && <Check className="w-4 h-4 mr-2" />}
              Deploy to Vercel
            </Button>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview">
          <Artifact
            name={artifact.name}
            content={artifact.content}
            contentType={artifact.contentType}
            
            // Built-in rendering for:
            // - code/* (syntax highlighted)
            // - text/html (sandboxed iframe)
            // - image/svg+xml (rendered)
            // - text/mermaid (diagram)
          />
        </TabsContent>
        
        <TabsContent value="code">
          <CodeBlock language={artifact.language} code={artifact.content} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Backend: Deploy to Vercel**

```typescript
// server/routes/artifacts.ts (NEW)
import { Hono } from 'hono';
import { Vercel } from '@vercel/sdk';

const app = new Hono();

app.post('/deploy', async (c) => {
  const { name, code, type } = await c.req.json();
  const tenantId = c.get('tenantId');
  
  const vercel = new Vercel({ accessToken: process.env.VERCEL_TOKEN });
  
  // Create deployment
  const deployment = await vercel.deployments.create({
    name: `artifact-${name}`,
    files: [
      {
        file: 'index.html',
        data: code
      }
    ],
    projectSettings: {
      framework: 'static'
    }
  });
  
  // Save to database
  const db = getDb();
  await db.insert(artifacts).values({
    tenantId,
    name,
    code,
    type,
    deploymentUrl: deployment.url
  });
  
  return c.json({ url: `https://${deployment.url}` });
});

app.post('/export/google-docs', async (c) => {
  const { title, content } = await c.req.json();
  const userId = c.get('userId');
  
  // Use Composio to export to Google Docs
  const result = await composio.execute({
    userId,
    toolName: 'GDOCS_CREATE_DOCUMENT',
    params: {
      title,
      content
    }
  });
  
  return c.json(result);
});

export default app;
```

### 3.3 Artifact Gallery

**Feature:** View all generated artifacts in one place

```tsx
// src/routes/artifacts/index.tsx (NEW)
export function ArtifactsRoute() {
  const { data: artifacts } = useQuery({
    queryKey: ['artifacts'],
    queryFn: async () => {
      const res = await fetch('/api/artifacts/list');
      return res.json();
    }
  });
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Your Artifacts</h1>
      
      <div className="grid grid-cols-3 gap-4">
        {artifacts?.map((artifact) => (
          <Card key={artifact.id} className="p-4">
            <div className="aspect-video bg-muted rounded mb-2">
              {/* Preview thumbnail */}
              <ArtifactPreview artifact={artifact} />
            </div>
            
            <h3 className="font-semibold">{artifact.name}</h3>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(artifact.createdAt)}
            </p>
            
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Navigate to chat where it was created
                  navigate({
                    to: '/chat/$conversationId',
                    params: { conversationId: artifact.conversationId },
                    hash: `#message-${artifact.messageId}`
                  });
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                View in Chat
              </Button>
              
              {artifact.deploymentUrl && (
                <Button
                  size="sm"
                  onClick={() => window.open(artifact.deploymentUrl)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**Database Schema:**

```typescript
// database/schema/artifacts.ts (NEW)
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  
  // Link back to conversation
  conversationId: uuid('conversation_id').references(() => conversations.id),
  messageId: uuid('message_id').references(() => messages.id),
  
  name: text('name').notNull(),
  type: text('type').$type<'code' | 'html' | 'svg' | 'mermaid' | 'react'>().notNull(),
  content: text('content').notNull(),
  
  // Deployment
  deploymentUrl: text('deployment_url'),
  deployedAt: timestamp('deployed_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 4. RAG (File Upload & Search)

> **Cross-ref**: 
> - [Architecture: RAG Data Flow with pgvector](./architecture.md#rag-data-flow-target---built-in-pgvector)
> - [Data Models: document_chunks](./data-models.md#document_chunks-for-rag)
> - [Tech Stack: Vector DB Comparison](./tech-stack.md#key-benefits-of-new-stack)

### 4.1 Current Implementation

```javascript
// api/server/routes/files/upload.js
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  // Upload to S3
  await s3.upload({ Key: file.filename, Body: file.buffer });
  
  // Save metadata
  await File.create({
    user: req.user.id,
    filename: file.originalname,
    type: file.mimetype
  });
  
  // Send to external RAG API for processing
  await axios.post(process.env.RAG_API_URL, {
    file_id: file.id,
    url: s3Url
  });
});
```

**Issues:**
- External RAG API dependency
- Separate vector database
- Complex pipeline

### 4.2 Target: Built-in pgvector

```typescript
// server/routes/files.ts (NEW)
import { put } from '@vercel/blob';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const app = new Hono();

app.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  // 1. Upload to Vercel Blob
  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true
  });
  
  // 2. Save file metadata
  const db = getDb();
  const [fileRecord] = await db.insert(files).values({
    tenantId,
    userId,
    name: file.name,
    url: blob.url,
    mimeType: file.type,
    size: file.size
  }).returning();
  
  // 3. Process in background (Cloudflare Queue or immediate)
  c.executionCtx.waitUntil(
    processFileForRAG(fileRecord.id, blob.url, tenantId)
  );
  
  return c.json({ file: fileRecord });
});

/**
 * Process file: download → chunk → embed → store
 */
async function processFileForRAG(
  fileId: string,
  fileUrl: string,
  tenantId: string
) {
  // 1. Download and load
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  
  // 2. Extract text (PDF, DOCX, etc.)
  const loader = new PDFLoader(new Blob([buffer]));
  const docs = await loader.load();
  
  // 3. Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  const chunks = await splitter.splitDocuments(docs);
  
  // 4. Generate embeddings for all chunks (batch)
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map(c => c.pageContent)
  });
  
  // 5. Save to Neon with pgvector
  const db = getDb();
  await db.insert(documentChunks).values(
    chunks.map((chunk, i) => ({
      tenantId,
      fileId,
      content: chunk.pageContent,
      embedding: embeddings[i],  // Vector column!
      chunkIndex: i,
      startPage: chunk.metadata.loc?.pageNumber,
      metadata: {
        tokens: Math.ceil(chunk.pageContent.length / 4),
        headings: extractHeadings(chunk.pageContent)
      }
    }))
  );
}

// File search tool (auto-exposed via oRPC)
app.post('/search',
  zValidator('json', z.object({
    query: z.string().describe('Search query'),
    fileIds: z.array(z.string()).optional(),
    limit: z.number().default(5)
  })),
  async (c) => {
    const { query, fileIds, limit } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    
    // Generate query embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query
    });
    
    // Semantic search with pgvector
    const db = getDb();
    const results = await db.execute(sql`
      SELECT 
        dc.content,
        dc.metadata,
        dc.start_page,
        f.name as file_name,
        f.url as file_url,
        (dc.embedding <=> ${embedding}::vector) as similarity
      FROM ${documentChunks} dc
      JOIN ${files} f ON dc.file_id = f.id
      WHERE dc.tenant_id = ${tenantId}
        ${fileIds ? sql`AND dc.file_id = ANY(${fileIds})` : sql``}
      ORDER BY similarity ASC
      LIMIT ${limit}
    `);
    
    return c.json({ results });
  }
);

export default app;
```

**Key Benefits:**
- ✅ No external RAG API
- ✅ Built-in vector search (pgvector)
- ✅ 50% faster queries
- ✅ Lower cost (no separate service)

---

## 5. LMS Features

> **Cross-ref**: 
> - [Data Models: courses and modules](./data-models.md#lms-tables)
> - [API Endpoints: LMS Routes](./api-endpoints.md#lms-routes-v1lms)
> - [Starter Integration: Week 11-12](./starter-integration.md#week-11-12-lms-features)

### 5.1 Course Management

**Current Implementation:**

```javascript
// api/models/Course.js
const courseSchema = new Schema({
  title: String,
  description: String,
  thumbnail: String,
  modules: [{
    id: String,
    title: String,
    videoUrl: String,
    recordingId: String
  }],
  tier: { type: String, enum: ['free', 'pro'] }
});
```

**Migration:**

```typescript
// database/schema/courses.ts (NEW)
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  
  title: text('title').notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  
  modules: jsonb('modules').$type<Array<{
    id: string;
    title: string;
    description: string;
    videoUrl?: string;
    duration?: number;
    order: number;
  }>>().default([]),
  
  tier: text('tier').$type<'free' | 'pro'>().default('free'),
  published: boolean('published').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User progress tracking
export const courseProgress = pgTable('course_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  
  completedModules: jsonb('completed_modules').$type<string[]>().default([]),
  lastAccessedModule: text('last_accessed_module'),
  progressPercentage: integer('progress_percentage').default(0),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5.2 Course UI

```tsx
// src/routes/academy/courses/$courseId.tsx (NEW)
export function CourseRoute() {
  const { courseId } = useParams();
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}`);
      return res.json();
    }
  });
  
  const { data: progress } = useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}/progress`);
      return res.json();
    }
  });
  
  return (
    <div className="flex h-screen">
      {/* Sidebar: Module list */}
      <div className="w-80 border-r p-4 space-y-2">
        <h2 className="font-bold text-lg">{course.title}</h2>
        <Progress value={progress.progressPercentage} />
        
        {course.modules.map((module, i) => (
          <Card
            key={module.id}
            className={cn(
              'p-3 cursor-pointer',
              progress.completedModules.includes(module.id) && 'bg-green-50'
            )}
          >
            <div className="flex items-center gap-2">
              {progress.completedModules.includes(module.id) ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
              <div>
                <p className="font-medium">{module.title}</p>
                <p className="text-xs text-muted-foreground">
                  {module.duration} min
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Main: Video player */}
      <div className="flex-1 p-6">
        <VideoPlayer
          src={currentModule.videoUrl}
          onComplete={() => markModuleComplete(currentModule.id)}
        />
      </div>
    </div>
  );
}
```

### 5.3 Community Chat (Replace CometChat)

> **Cross-ref**: 
> - [Tech Stack: CometChat Replacement](./tech-stack.md#third-party-services)
> - [Architecture: Durable Objects Pattern](./architecture.md#target-system-architecture-shadflareai--neon--orpc)
> - [Dependencies: CometChat Migration](./dependencies.md#replaced-dependencies)

**Current:** Uses CometChat SDK (external service, $$$)

**Target:** Build in-house with Cloudflare Durable Objects + WebSockets

```typescript
// server/durable-objects/chat-room.ts (NEW)
export class ChatRoom extends DurableObject {
  sessions: Set<WebSocket> = new Set();
  
  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }
    
    const { 0: client, 1: server } = new WebSocketPair();
    await this.handleSession(server);
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  async handleSession(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);
    
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      // Broadcast to all connected users
      this.broadcast(message);
      
      // Save to database
      this.saveMessage(message);
    });
    
    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
    });
  }
  
  broadcast(message: any) {
    for (const ws of this.sessions) {
      ws.send(JSON.stringify(message));
    }
  }
  
  async saveMessage(message: any) {
    // Save to Neon
    const db = getDb();
    await db.insert(communityMessages).values({
      roomId: this.env.roomId,
      userId: message.userId,
      content: message.content
    });
  }
}
```

**Frontend:**

```tsx
// src/components/community/chat-room.tsx (NEW)
export function CommunityChat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    // Connect to Durable Object
    const socket = new WebSocket(
      `wss://api.solo-os.com/community/${roomId}`
    );
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);
    };
    
    setWs(socket);
    
    return () => socket.close();
  }, [roomId]);
  
  const sendMessage = (content: string) => {
    ws?.send(JSON.stringify({
      userId: currentUser.id,
      content,
      timestamp: Date.now()
    }));
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <Avatar user={msg.user} />
            <div>
              <p className="font-semibold">{msg.user.name}</p>
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
      
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

**Benefits:**
- ✅ No external service ($0 vs $299/mo)
- ✅ Full control over features
- ✅ Scales globally (Durable Objects)
- ✅ Lower latency

### 5.4 Calendar

**Current Implementation:**
Custom calendar with event management

**Migration:** Keep similar, but add Composio integration for Google Calendar sync

```tsx
// src/routes/academy/calendar.tsx (NEW)
import { Calendar } from '@/components/ui/calendar';
import { useQuery, useMutation } from '@tanstack/react-query';

export function CalendarRoute() {
  const [date, setDate] = useState<Date>(new Date());
  
  const { data: events } = useQuery({
    queryKey: ['calendar-events', date],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/events?month=${date.getMonth()}`);
      return res.json();
    }
  });
  
  const createEvent = useMutation({
    mutationFn: async (event: NewEvent) => {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        body: JSON.stringify(event)
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Optionally sync to Google Calendar via Composio
      if (user.googleCalendarConnected) {
        fetch('/api/calendar/sync-to-google', {
          method: 'POST',
          body: JSON.stringify({ eventId: data.id })
        });
      }
    }
  });
  
  return (
    <div className="p-6">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
      />
      
      <div className="mt-6">
        <h3 className="font-semibold mb-4">Events for {formatDate(date)}</h3>
        {events?.map((event) => (
          <Card key={event.id} className="p-4 mb-2">
            <h4 className="font-medium">{event.title}</h4>
            <p className="text-sm text-muted-foreground">
              {formatTime(event.startTime)} - {formatTime(event.endTime)}
            </p>
            {event.meetingUrl && (
              <Button size="sm" variant="outline" className="mt-2">
                <Video className="w-4 h-4 mr-2" />
                Join Meeting
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 6. Memory System

> **Cross-ref**: 
> - [Data Models: memories table](./data-models.md#memories)
> - [Architecture: Memory Injection](./architecture.md#key-database-improvements)
> - [Starter Integration: Week 7-8](./starter-integration.md#week-7-8-memory-system)

### Current Implementation

```javascript
// api/server/services/MemoryService.js
class MemoryService {
  async addMemory(userId, content) {
    const embedding = await openai.embeddings.create({
      input: content,
      model: 'text-embedding-3-small'
    });
    
    await axios.post(process.env.RAG_API_URL + '/memory', {
      userId,
      content,
      embedding: embedding.data[0].embedding
    });
  }
  
  async getRelevantMemories(userId, query) {
    const embedding = await openai.embeddings.create({
      input: query,
      model: 'text-embedding-3-small'
    });
    
    const results = await axios.post(process.env.RAG_API_URL + '/memory/search', {
      userId,
      embedding: embedding.data[0].embedding,
      limit: 5
    });
    
    return results.data;
  }
}
```

### Target: Built-in with pgvector

```typescript
// database/schema/memories.ts (ALREADY SHOWN IN ARCHITECTURE.MD)
// See architecture.md for schema

// server/routes/memory.ts (NEW)
const app = new Hono();

// Add memory (auto-exposed via oRPC)
app.post('/add',
  zValidator('json', z.object({
    content: z.string().describe('Memory content'),
    type: z.enum(['fact', 'preference', 'context'])
  })),
  async (c) => {
    const { content, type } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    
    // Generate embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: content
    });
    
    // Save
    const db = getDb();
    const [memory] = await db.insert(memories).values({
      tenantId,
      userId,
      content,
      type,
      embedding
    }).returning();
    
    return c.json({ memory });
  }
);

// Search memories (auto-exposed via oRPC)
app.post('/search',
  zValidator('json', z.object({
    query: z.string().describe('Search query'),
    limit: z.number().default(5)
  })),
  async (c) => {
    const { query, limit } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    
    // Generate embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query
    });
    
    // Search
    const db = getDb();
    const results = await db.execute(sql`
      SELECT content, type, metadata
      FROM ${memories}
      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${limit}
    `);
    
    return c.json({ memories: results });
  }
);

export default app;
```

**Agent automatically has `memory_add` and `memory_search` tools via oRPC!**

---

## Feature Comparison Table

> **See**: [Migration Plan: Phased Approach](./migration-plan.md) for timeline and execution strategy

| Feature | Current (LibreChat) | Target (ShadFlareAi) | Effort | Priority |
|---------|---------------------|----------------------|--------|----------|
| **Chat UI** | Custom SSE | Vercel AI SDK | 1 week | P0 |
| **Streaming** | Manual | Built-in | 1 day | P0 |
| **Agents** | Langchain | Vercel AI SDK | 2 weeks | P0 |
| **Agent Builder** | Basic UI | Full oRPC + Composio | 2 weeks | P0 |
| **RAG** | External API | Built-in pgvector | 1 week | P1 |
| **Memory** | External | Built-in pgvector | 3 days | P1 |
| **Artifacts** | Minimal | Full system | 1 week | P1 |
| **Artifact Export** | None | Google Docs, Vercel | 2 days | P2 |
| **Artifact Gallery** | None | Full UI | 1 week | P2 |
| **LMS Courses** | Custom | Keep similar | 1 week | P2 |
| **Community Chat** | CometChat ($299/mo) | In-house Durable Objects | 2 weeks | P2 |
| **Calendar** | Custom | Enhanced + Google sync | 1 week | P3 |
| **Message Board** | None | Build new | 1 week | P3 |

---

## Migration Priority

### Phase 1: Core Chat (Week 1-2)
1. Chat UI with Vercel AI SDK
2. Basic agent execution
3. Message persistence

### Phase 2: Agents & Tools (Week 3-4)
1. oRPC tool generation
2. Composio integration
3. Agent builder UI

### Phase 3: Advanced AI (Week 5-6)
1. RAG with pgvector
2. Memory system
3. Artifacts

### Phase 4: LMS & Community (Week 7-10)
1. Course management
2. In-house community chat
3. Calendar

### Phase 5: Polish (Week 11-12)
1. Artifact gallery
2. Export features
3. Performance optimization

---

## Next Steps

1. **Review this document** with your team
2. **Prioritize features** based on business needs
3. **Start with Phase 1** (core chat)
4. **Build incrementally** - ship early, ship often

---

## Related Documentation

| Document | What It Covers | Read Next If... |
|----------|----------------|-----------------|
| **[Architecture](./architecture.md)** | System diagrams, data flow, deployment | You want to understand how everything fits together |
| **[Starter Integration](./starter-integration.md)** | Week-by-week implementation guide | You're ready to start building |
| **[Tech Stack](./tech-stack.md)** | Current vs target technology | You want to understand technology choices |
| **[Data Models](./data-models.md)** | Database schemas and migrations | You need to plan data migration |
| **[API Endpoints](./api-endpoints.md)** | Complete API reference | You're building the API layer |
| **[Pain Points](./pain-points.md)** | Why we're rebuilding | You need to justify the rebuild |
| **[Migration Plan](./migration-plan.md)** | Phased migration strategy | You're planning the project timeline |

**Start here**: [Starter Integration Guide](./starter-integration.md) for immediate action items.
