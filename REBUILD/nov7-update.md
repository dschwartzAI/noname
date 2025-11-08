🏗️ Infrastructure Architecture & Implementation Plan
Document Purpose
This document captures the complete infrastructure architecture for ShadFlareAi based on production guidance from Ben (experienced Cloudflare developer). This replaces preliminary assumptions and provides the definitive technical direction for multi-tenant AI platform development.

📊 Four-Tier Storage Architecture
Overview
The platform uses four distinct storage systems, each optimized for specific use cases:
┌─────────────────────────────────────────────────────┐
│           YOUR MULTI-TENANT AI PLATFORM             │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬──────────────┐
         │               │               │              │
         ▼               ▼               ▼              ▼
    
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   NEON PG    │  │  VECTORIZE   │  │      R2      │  │   DURABLE    │
│  (Postgres)  │  │   (Vectors)  │  │   (Objects)  │  │   OBJECTS    │
│              │  │              │  │              │  │ + SQLite     │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
│                 │                 │                 │
│ • Users         │ • Doc chunks    │ • Logos         │ • COMMUNITY   │
│ • Orgs          │ • Embeddings    │ • Profile pics  │   MESSENGER   │
│ • Billing       │ • RAG search    │ • Attachments   │   - DMs       │
│ • AI chat       │                 │ • Documents     │   - Groups    │
│   history       │                 │                 │   - Inbox     │
│   (archived)    │                 │                 │ • WebSockets  │
│ • Analytics     │                 │                 │ • Real-time   │
│ • Backups       │                 │                 │ • Sync        │
│                 │                 │                 │ • Notifications│
│                 │                 │                 │   (10GB each) │
└─────────────────┴─────────────────┴─────────────────┴───────────────┘

🗄️ Storage Tier Responsibilities
Tier 1: Neon Postgres (Structured Data)
Purpose: Permanent, queryable records requiring relational structure
Stores:

User accounts & profiles
Organization settings (including logo_url, favicon_url)
Billing & subscription data
AI chat history (archived conversations)
Analytics & metrics
Backup records

When to use:

✅ Data needs complex queries/joins
✅ ACID transactions required
✅ Long-term permanent storage
✅ Cross-organization analytics

Current implementation: ✅ Complete (Phase 0)

Organizations table with logo/favicon fields
Users table with roles and multi-tenancy
Better Auth integration


Tier 2: Cloudflare Vectorize (Vector Embeddings)
Purpose: Semantic search for RAG (Retrieval Augmented Generation)
Stores:

Document embeddings (chunked text)
Knowledge base vectors
Semantic search indices

When to use:

✅ "Find documents similar to this query"
✅ RAG context retrieval for AI agents
✅ Semantic search across knowledge bases

Current implementation: ⏳ Planned (Phase 2)

Multi-tenant vector storage
Organization-scoped knowledge bases
Integration with AI chat for context

Ben's guidance: "Use Cloudflare AI search (Vectorize) for RAG - this is the way"

Tier 3: Cloudflare R2 (Object Storage)
Purpose: Large binary files and static assets
Stores:

Organization logos ✅ Implemented
Favicons ✅ Implemented
User profile pictures
Document uploads (PDFs, CSVs, images)
Message attachments
Agent avatars

When to use:

✅ Files > 1MB
✅ Public URLs needed
✅ Images, documents, media

Current implementation: ✅ Partially complete

app-assets bucket configured
Logo/favicon upload working
Public URL generation

Next steps:

Profile picture uploads
Document management for RAG
Message attachment handling


Tier 4: Durable Objects (Real-Time State)
Purpose: Live coordination, WebSockets, real-time messaging
Stores:

Community messenger conversations (DMs, groups)
Active WebSocket connections
Real-time message broadcasts
Typing indicators (ephemeral)
Online/offline presence
Message delivery state

Critical Features:

Built-in 10GB SQLite per conversation
Automatic persistence (no manual save code needed)
WebSocket connections built-in
Strong consistency guarantees

When to use:

✅ Real-time messaging (<100ms delivery)
✅ WebSocket coordination
✅ Typing indicators, read receipts
✅ Multi-device sync
✅ Live collaboration features

Current implementation: ❌ Not yet started
Ben's guidance:

"Use Durable Objects for agent state stuff - you can save messages there"
"DO has 10GB node SQLite storage" (automatic persistence)
"Great for chat, I use it for data sync and notifications"


🎯 Two Separate Chat Systems
System 1: Community Messenger (User ↔ User)
Purpose: Real-time messaging between users within organizations
UI Example: Inbox with contacts (Alex John, Taylor Grande, etc.)
Storage: Durable Objects (primary) + Neon (backup/analytics)
Architecture:
User sends DM
  ↓
Find/Create Durable Object for conversation
  ├─ WebSocket already open
  ├─ Message saved to DO's SQLite (automatic)
  ├─ Instant broadcast to participants
  ├─ Typing indicators, read receipts
  └─ Periodic sync to Neon for backup
Features enabled by DO:

✅ Instant message delivery (<100ms)
✅ Typing indicators ("Taylor is typing...")
✅ Read receipts ("Delivered", "Read")
✅ Online/offline status
✅ Multi-device sync
✅ Message history (10GB per conversation)

Implementation priority: Phase 3 (after RAG)

System 2: AI Agent Chat (User ↔ AI)
Purpose: Conversations with AI models and custom agents
UI: Chat interface with AI agents
Storage: Neon Postgres (primary) + Vectorize (RAG context)
Architecture:
User asks AI agent a question
  ↓
Vercel AI SDK streaming
  ├─ Query Vectorize for RAG context
  ├─ Call AI provider (OpenAI/Anthropic)
  ├─ Stream response to user
  └─ Save conversation to Neon
No Durable Objects needed because:

No real-time coordination between users
Vercel AI SDK handles streaming
No WebSocket persistence required
Simpler architecture for single-user chats

Current implementation: ✅ Working with Vercel AI SDK v5

🔧 Cloudflare Agent SDK
What It Is
A higher-level SDK built ON TOP of Vercel AI SDK specifically for Cloudflare Workers + Durable Objects.
Relationship:
YOUR APPLICATION CODE
        ↓
CLOUDFLARE AGENT SDK (state management, DO integration)
        ↓
VERCEL AI SDK (streaming, providers, tools)
        ↓
AI PROVIDERS (OpenAI, Anthropic, xAI)
Key Features

Automatic persistence to Durable Object's SQLite
Conversation history managed automatically
State management for agent context
Built for edge compute (Cloudflare Workers)

When to Use

✅ If you need AI chat WITH persistent state in Durable Objects
✅ If you want automatic conversation management
✅ If building multi-turn agent conversations

Current Decision
NOT using Agent SDK for AI chat because:

AI chat doesn't need Durable Objects
Vercel AI SDK is sufficient for streaming
Simpler architecture with just Postgres storage

Might use later for: Advanced agent state if building autonomous agents that need DO coordination
Ben's note: "AgentSDK lives on top of AI SDK - they work together but are different"

🌐 WebSockets vs Polling
What is a WebSocket?
A persistent, bidirectional connection between browser and server (like a phone call vs texting).
HTTP Polling (Texting):
Browser: "Any new messages?" (every 10 seconds)
Server: "Nope"
Browser: "Any new messages?"
Server: "Yes! Here's one"

❌ 0-10 second delay
❌ Wastes bandwidth
❌ High server load

WebSocket (Phone Call):
Browser: "Open connection"
Server: "Connected!"
[Connection stays open]
Server: "NEW MESSAGE!" (instant push)
Browser: "Got it!"

✅ <100ms delivery
✅ Efficient (one connection)
✅ Lower server load

When You NEED WebSockets

Real-time chat (Slack/Discord UX)
Typing indicators
Read receipts
Online/offline status
Live collaboration

When Polling is Fine

Email-style messaging
Low message volume
Simplicity preferred
10-30s delay acceptable

Implementation Decision
Community Messenger → Durable Objects + WebSockets

User expectation: instant delivery
Typing indicators are table stakes
Modern chat UX required

Alternative (if simplified): Start with polling, migrate to WebSockets later if users complain

💰 Cost Projections (10K Active Users)
Storage TierMonthly CostUse CaseNeon Postgres$20-50User data, AI history, analyticsVectorize$10-30RAG embeddings, semantic searchR2$5-15Images, files, documentsDurable Objects$5-20Active messenger sessionsTotal$40-115Complete infrastructure
Cost drivers:

Neon: Scales with data volume + query frequency
Vectorize: Scales with vector count + search requests
R2: Storage + requests (no egress fees!)
DO: Active instance count + compute time

Ben's insight: DO can be cheaper than polling because it eliminates constant database queries

🚀 Implementation Phases
Phase 0: Foundation ✅ COMPLETE
Status: Done

Neon Postgres schema (users, orgs, profiles)
Better Auth integration
R2 bucket for logos/favicons
Basic multi-tenancy

Phase 1: AI Chat Core ✅ MOSTLY COMPLETE
Current status: Working with Vercel AI SDK

 Streaming chat with multiple providers
 Message history in Postgres
 UI polish and error handling
 Message persistence improvements

Phase 2: RAG & Knowledge Bases ⏳ NEXT
Priority: High
Components:

Set up Vectorize namespace
Document upload to R2
Text extraction and chunking
Embedding generation
Vector storage (multi-tenant)
RAG integration with AI chat
Organization-scoped knowledge bases

Ben's guidance: "Use Cloudflare AI search (Vectorize) - this is the way"
Phase 3: Community Messenger 📅 FUTURE
Priority: After RAG
Components:

Durable Object classes for conversations
WebSocket connection management
Message persistence to DO SQLite
Real-time broadcast logic
Typing indicators
Read receipts and presence
Frontend inbox UI
Periodic backup to Neon

Technical notes:

Each conversation = one Durable Object instance
Automatic persistence (no manual save code)
10GB storage per conversation
Strong consistency guarantees

Phase 4: Advanced Features 🔮 LATER

File sharing in messenger
Voice/video calls (Stream integration)
Advanced RAG (multi-modal, citations)
Agent marketplace
White-label customization tools


🔐 Secrets Management (IMPLEMENTED)
Current Implementation ✅
Local development:

.dev.vars file (gitignored)
Contains all API keys
Automatically loaded by Wrangler

Production:

Cloudflare Secrets (encrypted vault)
Set via wrangler secret put KEY_NAME
Injected into Workers via env object

Automation:

add-secrets.sh script uploads all secrets from .dev.vars
Never commit API keys to git
Rotate keys by updating .dev.vars + re-running script

Secrets stored:

ANTHROPIC_API_KEY
OPENAI_API_KEY
XAI_API_KEY
Better Auth secrets
R2 credentials (via binding)


🛠️ Development Workflow
Current Setup ✅

dev-servers.sh - Auto-restart both Vite and Wrangler
Frontend: http://localhost:5174
Backend: Cloudflare Workers via Wrangler
Vite proxy for /api requests
Remote KV for session persistence

Database Operations

Neon MCP for direct database access
Drizzle ORM for type-safe queries
Migrations tracked in git

File Uploads

R2 bucket: app-assets
Folder structure: logos/, favicons/, documents/
Public URLs via R2.dev subdomain


📋 Next Actions
Immediate (This Week)

Finish AI chat stability

Error handling
Loading states
Message retry logic


Start Vectorize setup

Create namespace
Test embedding generation
Build RAG proof-of-concept



Short-term (Next 2 Weeks)

Document upload system

UI for file uploads
Text extraction pipeline
Chunk + embed workflow


RAG integration

Context retrieval
Relevance scoring
Multi-tenant isolation



Medium-term (Next Month)

Community messenger foundation

Durable Object classes
WebSocket setup
Basic DM functionality




🎓 Key Learnings from Ben
1. Durable Objects Are Not Just In-Memory
Myth: DOs are ephemeral, need manual persistence
Reality: 10GB built-in SQLite, automatic persistence
Impact: Simpler code, no manual save logic needed
2. Vectorize for RAG is Production-Ready
Guidance: "Use Cloudflare AI search - this is the way"
Implication: No need for Pinecone, Weaviate, or other vector DBs
3. Agent SDK is Optional Layer
Relationship: Agent SDK → Vercel AI SDK → AI Providers
Use case: When you need AI + Durable Object state management
Our decision: Not needed for basic AI chat, might use later
4. WebSockets via DO Are Built-In
Insight: "Great for chat, I use it for data sync and notifications"
Architecture: Each conversation = one DO with WebSocket coordination
Benefit: No separate WebSocket service needed
5. Start Simple, Add Complexity When Needed
Approach:

Phase 0: Postgres only ✅
Phase 1: Add AI streaming ✅
Phase 2: Add Vectorize for RAG ⏳
Phase 3: Add DOs for messenger 📅


📚 Resources & References
Cloudflare Docs

Durable Objects: https://developers.cloudflare.com/durable-objects/
Vectorize: https://developers.cloudflare.com/vectorize/
R2 Storage: https://developers.cloudflare.com/r2/
Workers AI: https://developers.cloudflare.com/workers-ai/

Current Stack

Vite + React 19 + TanStack Router
Hono (backend framework)
Drizzle ORM + Neon Postgres
Better Auth
Vercel AI SDK v5
Cloudflare Workers + R2

Tools & MCPs

Context7 MCP (SDK documentation)
Neon MCP (database operations)
Claude Code (primary development agent)


✅ Architecture Validation Checklist

 Multi-tenant data isolation designed
 API keys secured (never in git)
 R2 for static assets configured
 Neon Postgres for structured data
 Vectorize namespace for RAG (next)
 Durable Objects for real-time (future)
 Development workflow automated
 Secrets management documented
 RAG pipeline designed (in progress)
 WebSocket architecture planned

 NEXT UP REFERENCE: nov-7-next.md 