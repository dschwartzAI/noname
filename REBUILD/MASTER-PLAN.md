# 🎯 MASTER PLAN: SoloOS Multi-Tenant AI Platform Rebuild

> **Last Updated**: 2024-11-07
> **Status**: Phase 0 Complete ✅ | Phase 1 In Progress 🔄
> **Timeline**: 18 weeks (4.5 months)
> **Current Sprint**: Week 1 - God Tier & Multi-Tenancy

---

## 📊 Executive Dashboard

### Current Status
```
Phase 0: Foundation          ████████████████████ 100% ✅ COMPLETE
Phase 1: God Tier            ████░░░░░░░░░░░░░░░░  20% 🔄 IN PROGRESS
Phase 2: Agent Builder       ░░░░░░░░░░░░░░░░░░░░   0% ⏳ NEXT
Phase 3: LMS System          ░░░░░░░░░░░░░░░░░░░░   0% 📅 PLANNED
Phase 4: Calendar            ░░░░░░░░░░░░░░░░░░░░   0% 📅 PLANNED
Phase 5: Community Chat      ░░░░░░░░░░░░░░░░░░░░   0% 📅 PLANNED
Phase 6: Artifacts Polish    ░░░░░░░░░░░░░░░░░░░░   0% 📅 PLANNED

Overall Progress: ████░░░░░░░░░░░░░░░░ 20% (Week 1 of 18)
```

### Key Milestones
| Milestone | Target Week | Status |
|-----------|-------------|--------|
| Foundation Complete | Week 0 | ✅ Done |
| God Dashboard Live | Week 1 | 🔄 In Progress |
| Agent Builder MVP | Week 7 | ⏳ Upcoming |
| LMS Beta | Week 11 | 📅 Planned |
| Real-time Chat Live | Week 16 | 📅 Planned |
| Full Launch | Week 18 | 🎯 Target |

### This Week's Focus (Week 1)
**Goal**: Complete God Tier Foundation

**Tasks**:
- [ ] Build God Dashboard UI (`/god-dashboard` route)
- [ ] Implement organization metrics display
- [ ] Add impersonation system
- [ ] Create owner invite database schema
- [ ] Setup email integration (Resend/SendGrid)

**Blockers**: None
**On Track**: ✅ Yes

---

## 🏗️ Four-Tier Architecture Overview

### Storage Architecture

```
┌─────────────────────────────────────────────────────┐
│           SOLO:OS MULTI-TENANT AI PLATFORM         │
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
```

### Tier Status & Use Cases

| Tier | Status | Use Case | Implementation |
|------|--------|----------|----------------|
| **Neon Postgres** | ✅ Complete | User data, billing, AI chat history | Drizzle ORM, multi-tenant RLS |
| **Vectorize** | ⏳ Next (Phase 2) | RAG embeddings, semantic search | Cloudflare AI search |
| **R2 Storage** | 🔄 Partial | Logos ✅, favicons ✅, docs ⏳ | `app-assets` bucket |
| **Durable Objects** | 📅 Future (Phase 5) | Real-time chat, WebSockets | 10GB SQLite + WS built-in |

**Architecture Documentation**: See [`nov7-update.md`](./nov7-update.md) for complete 4-tier breakdown

---

## 📅 18-Week Roadmap

### Timeline Overview

```
Week  1-3:  Phase 1 - God Tier & Multi-Tenancy           🔄 IN PROGRESS
Week  4-7:  Phase 2 - Agent & Tool Builder               ⏳ NEXT
Week  8-11: Phase 3 - Learning Management System         📅 PLANNED
Week 12-13: Phase 4 - Calendar & Scheduling              📅 PLANNED
Week 14-16: Phase 5 - Community Chat (Durable Objects)   📅 PLANNED
Week 17-18: Phase 6 - Artifacts Polish & Deploy          📅 PLANNED
```

### Gantt Chart (Text)

```
Phase           │ W1│ W2│ W3│ W4│ W5│ W6│ W7│ W8│ W9│W10│W11│W12│W13│W14│W15│W16│W17│W18│
─────────────────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
0: Foundation    │✅ │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
1: God Tier      │🔄 │⏳ │⏳ │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
2: Agents        │   │   │   │⏳ │⏳ │⏳ │⏳ │   │   │   │   │   │   │   │   │   │   │   │
3: LMS           │   │   │   │   │   │   │   │⏳ │⏳ │⏳ │⏳ │   │   │   │   │   │   │   │
4: Calendar      │   │   │   │   │   │   │   │   │   │   │   │⏳ │⏳ │   │   │   │   │   │
5: Chat          │   │   │   │   │   │   │   │   │   │   │   │   │   │⏳ │⏳ │⏳ │   │   │
6: Artifacts     │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │⏳ │⏳ │
```

---

## ✅ Current Sprint: Week 1

### Sprint Goal
**Complete God Tier foundation for multi-tenant management**

### Tasks & Acceptance Criteria

#### 1. God Dashboard UI 🔥 HIGH PRIORITY
**Status**: ⏳ Not Started
**Effort**: 2-3 days
**Assignee**: TBD

**Tasks**:
- [ ] Create `/god-dashboard` route in TanStack Router
- [ ] Build OrganizationList component
- [ ] Add metrics display (member count, tier, revenue)
- [ ] Implement search/filter functionality
- [ ] Add quick actions (suspend, upgrade, delete)

**Acceptance Criteria**:
- God user can view all organizations in a table
- Metrics show: # members, tier, created date
- Search works by organization name
- Quick actions display confirmation dialogs

**Technical Spec**:
```typescript
// API Endpoint (already documented)
app.get('/api/god/organizations', requireGod, async (c) => {
  const orgs = await db.query.organization.findMany({
    with: {
      members: { with: { user: true } },
      _count: { messages: true, conversations: true }
    }
  });
  return c.json(orgs);
});
```

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#11-finalize-god-tier-hierarchy--high-priority)

---

#### 2. Impersonation System 🔥 HIGH PRIORITY
**Status**: ⏳ Not Started
**Effort**: 3 days
**Assignee**: TBD

**Tasks**:
- [ ] Add "View as Owner" button in God Dashboard
- [ ] Implement org context switching middleware
- [ ] Create impersonation banner component
- [ ] Add exit impersonation functionality
- [ ] Test with different org contexts

**Acceptance Criteria**:
- God can click "View as Owner" on any org
- App switches to that org's context
- Yellow banner shows "Viewing as: {Org Name}"
- "Exit Impersonation" returns to God view
- All data is scoped to impersonated org

**Technical Spec**:
```typescript
// Middleware
app.use('/api/*', async (c, next) => {
  const { user } = await auth.api.getSession();

  if (user?.isGod && c.req.header('X-Impersonate-Org')) {
    const orgId = c.req.header('X-Impersonate-Org');
    c.set('orgId', orgId);
    c.set('isImpersonating', true);
  }

  await next();
});
```

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#12-impersonation-system--high-priority)

---

#### 3. Owner Invite System 🔥 HIGH PRIORITY
**Status**: ⏳ Not Started
**Effort**: 4 days
**Assignee**: TBD

**Tasks**:
- [ ] Create `owner_invites` database table
- [ ] Build invite generation API endpoint
- [ ] Setup email integration (Resend or SendGrid)
- [ ] Create email template for invites
- [ ] Build `/signup/:token` route
- [ ] Implement auto-org creation on signup
- [ ] Mark invites as used after signup

**Acceptance Criteria**:
- God can send invite email with unique token
- Email contains branded signup link
- Signup form pre-fills email from invite
- New organization is created automatically
- Invitee becomes owner of new org
- Invite token is marked as used
- Expired invites are rejected

**Database Schema**:
```sql
CREATE TABLE owner_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  organization_preset JSONB,  -- pre-configured org settings
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_by TEXT REFERENCES user(id)
);
```

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#13-owner-invite-system-via-email--high-priority)

---

### Sprint Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Email service integration delay | Medium | Start with Resend (simple API) |
| Impersonation security concerns | High | Audit all tenant-scoped queries |
| Token expiration edge cases | Low | Document expiration logic clearly |

---

## 📋 Feature Implementation Matrix

### Complete Feature Tracking

| Feature | Phase | Priority | Status | Effort | Dependencies | Week | Acceptance Criteria |
|---------|-------|----------|--------|--------|--------------|------|---------------------|
| **Foundation** | | | | | | | |
| Neon Postgres Setup | 0 | 🔥 | ✅ Complete | 2d | None | 0 | Database connected, Drizzle working |
| Better Auth | 0 | 🔥 | ✅ Complete | 1d | Neon | 0 | Sign in/up working |
| R2 Logo Upload | 0 | 🔥 | ✅ Complete | 1d | None | 0 | Logos upload + display |
| R2 Favicon Upload | 0 | 🚀 | ✅ Complete | 1d | R2 Logo | 0 | Favicons dynamic |
| Dev Server Auto-restart | 0 | 🚀 | ✅ Complete | 0.5d | None | 0 | Servers restart on crash |
| **Phase 1: God Tier** | | | | | | | |
| God Dashboard | 1 | 🔥 | ⏳ Not Started | 3d | None | 1 | View all orgs with metrics |
| Impersonation | 1 | 🔥 | ⏳ Not Started | 3d | God Dashboard | 1-2 | Switch org context |
| Owner Invites | 1 | 🔥 | ⏳ Not Started | 4d | Email service | 2-3 | Send invite, auto-create org |
| **Phase 2: Agents** | | | | | | | |
| Agent Builder UI | 2 | 🔥 | ⏳ Next | 10d | Phase 1 | 4-5 | Create custom agents |
| Tool Builder (oRPC) | 2 | 🚀 | ⏳ Next | 7d | Agent Builder | 5-6 | Custom tools working |
| Hybrid Offer Tool Migration | 2 | 🔥 | ⏳ Next | 2d | Tool Builder | 6 | Tool callable by agents |
| Daily Client Machine Migration | 2 | 🔥 | ⏳ Next | 2d | Tool Builder | 6 | Tool callable by agents |
| Composio Integration | 2 | 🚀 | ⏳ Next | 3d | None | 7 | External tools (GitHub, Gmail) |
| **Phase 3: LMS** | | | | | | | |
| Module System | 3 | 🚀 | 📅 Planned | 10d | Phase 2 | 8-9 | Modules/sub-modules created |
| Stream Video Upload | 3 | 🚀 | 📅 Planned | 3d | Modules | 9 | Videos upload + play |
| Tier Restrictions | 3 | 🚀 | 📅 Planned | 3d | Modules | 10 | Free/Pro access enforced |
| Progress Tracking | 3 | 🚀 | 📅 Planned | 2d | Modules | 10-11 | Track user completion |
| Certificate Generation | 3 | ⏳ | 📅 Planned | 2d | Progress | 11 | Certificates on completion |
| **Phase 4: Calendar** | | | | | | | |
| Calendar UI | 4 | 🚀 | 📅 Planned | 5d | Phase 3 | 12 | Month/week/day views |
| Google Calendar Sync | 4 | 🚀 | 📅 Planned | 3d | Calendar UI | 12-13 | Sync events via Composio |
| Booking System | 4 | 🚀 | 📅 Planned | 2d | Calendar UI | 13 | Owners can be booked |
| **Phase 5: Chat** | | | | | | | |
| Durable Objects Setup | 5 | 🔥 | 📅 Planned | 5d | Phase 4 | 14 | DO classes deployed |
| WebSocket Connections | 5 | 🔥 | 📅 Planned | 3d | DO Setup | 14-15 | WS connected |
| DM Functionality | 5 | 🔥 | 📅 Planned | 4d | WebSockets | 15 | 1-on-1 messaging |
| Group Chats | 5 | 🚀 | 📅 Planned | 3d | DMs | 15-16 | Multi-user chats |
| Typing Indicators | 5 | 🚀 | 📅 Planned | 1d | WebSockets | 16 | "User is typing..." |
| Read Receipts | 5 | ⏳ | 📅 Planned | 1d | DMs | 16 | Delivered/Read status |
| **Phase 6: Artifacts** | | | | | | | |
| Vercel Deploy | 6 | ⏳ | 📅 Planned | 3d | Phase 5 | 17 | Deploy HTML artifacts |
| Google Docs Export | 6 | ⏳ | 📅 Planned | 2d | Composio | 17 | Export to Docs |
| GitHub Gist Export | 6 | ⏳ | 📅 Planned | 1d | Composio | 18 | Share code snippets |
| Artifact Gallery | 6 | ⏳ | 📅 Planned | 2d | None | 18 | Browse all artifacts |

**Legend**: 🔥 HIGH | 🚀 MEDIUM | ⏳ LOW
**Total Features**: 36 | **Complete**: 5 (14%) | **In Progress**: 0 | **Remaining**: 31

---

## 🎯 Phase Breakdown

### Phase 0: Foundation ✅ COMPLETE

**Duration**: Pre-Week 1
**Status**: ✅ 100% Complete

**What Was Built**:
- ✅ Neon Postgres database configured
- ✅ Drizzle ORM with multi-tenant schema
- ✅ Better Auth integration (email/password + OAuth)
- ✅ R2 bucket for logos and favicons
- ✅ Logo upload feature working
- ✅ Favicon upload with dynamic browser icon
- ✅ Auto-restart dev servers (`dev-servers.sh`)
- ✅ Secrets management (`.dev.vars` + `add-secrets.sh`)

**Reference**: [`nov7-update.md`](./nov7-update.md#phase-0-foundation--complete)

---

### Phase 1: God Tier & Multi-Tenancy 🔄 IN PROGRESS

**Duration**: Weeks 1-3
**Status**: 🔄 20% Complete (Week 1 of 3)

**Goal**: Enable God user to manage all organizations and invite owners

**Features**:
1. **God Dashboard** (Week 1) - View all orgs with metrics
2. **Impersonation System** (Weeks 1-2) - "View as Owner" functionality
3. **Owner Invite System** (Weeks 2-3) - Email invites with auto-org creation

**Success Criteria**:
- [ ] God can see all organizations in dashboard
- [ ] God can impersonate any owner
- [ ] God can send owner invite emails
- [ ] Invites create organizations automatically
- [ ] Impersonation banner shows active context

**Technical Stack**:
- TanStack Router for routing
- Better Auth for session management
- Neon Postgres for data
- Resend/SendGrid for emails

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-1-god-tier--multi-tenancy-weeks-1-3)

---

### Phase 2: Agent & Tool Builder ⏳ NEXT

**Duration**: Weeks 4-7
**Status**: ⏳ 0% (Starts Week 4)

**Goal**: Enable owners to create custom AI agents with tools

**Features**:
1. **Agent Builder UI** (Weeks 4-5)
   - Agent configuration form
   - System prompt editor
   - Model selection (GPT-4, Claude, Grok)
   - Temperature/token settings

2. **Tool Builder** (Weeks 5-6)
   - oRPC auto-tool generation from API endpoints
   - Custom tool creation UI
   - Tool testing interface

3. **Tool Migrations** (Week 6)
   - Hybrid Offer Printer (from LibreChat)
   - Daily Client Machine (from LibreChat)
   - Database query tool
   - Memory retrieval tool

4. **Composio Integration** (Week 7)
   - GitHub integration (create issues, PRs)
   - Gmail integration (send emails)
   - Google Calendar (sync events)
   - External OAuth flows

**Success Criteria**:
- [ ] Owners can create custom agents
- [ ] Hybrid Offer Printer tool migrated and working
- [ ] Daily Client Machine tool migrated and working
- [ ] Tools integrate via oRPC
- [ ] Composio external tools callable by agents

**Technical Stack**:
- Vercel AI SDK for agent execution
- oRPC for custom tool generation
- Composio for external service integrations
- Zod for tool schema validation

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-2-agent--tool-builder-weeks-4-7)

---

### Phase 3: Learning Management System 📅 PLANNED

**Duration**: Weeks 8-11
**Status**: 📅 0% (Starts Week 8)

**Goal**: Build course module system with video content and progress tracking

**Features**:
1. **Module System** (Weeks 8-9)
   - Module/sub-module hierarchy
   - Course creation UI
   - Content organization

2. **Stream Video Integration** (Week 9)
   - Video upload to Stream
   - Transcript generation
   - Video playback with resume

3. **Tier-Based Access** (Week 10)
   - Free/Pro/Enterprise restrictions
   - Lock UI for restricted content
   - Upgrade CTAs

4. **Progress Tracking** (Weeks 10-11)
   - Track module completion
   - Watch time analytics
   - Certificate generation on completion

**Success Criteria**:
- [ ] Modules/sub-modules can be created
- [ ] Videos upload and play correctly
- [ ] Tier restrictions enforced (free users can't access pro content)
- [ ] User progress tracked per module
- [ ] Certificates generate on course completion

**Database Tables**:
```sql
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organization(id),
  title TEXT NOT NULL,
  tier_required TEXT  -- 'free', 'pro', 'enterprise'
);

CREATE TABLE sub_modules (
  id TEXT PRIMARY KEY,
  module_id TEXT REFERENCES modules(id),
  video_url TEXT,  -- Stream video URL
  transcript TEXT
);

CREATE TABLE user_progress (
  user_id TEXT REFERENCES user(id),
  sub_module_id TEXT REFERENCES sub_modules(id),
  completed_at TIMESTAMP,
  watch_time_seconds INTEGER
);
```

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-3-learning-management-system-weeks-8-11)

---

### Phase 4: Calendar & Scheduling 📅 PLANNED

**Duration**: Weeks 12-13
**Status**: 📅 0% (Starts Week 12)

**Goal**: Add calendar functionality with Google Calendar sync

**Features**:
1. **Calendar UI** (Week 12)
   - Month/week/day views
   - Event creation
   - Timezone handling

2. **Google Calendar Sync** (Weeks 12-13)
   - OAuth via Composio
   - Two-way sync
   - Event notifications

3. **Booking System** (Week 13)
   - Owners can be booked
   - Availability management
   - Email confirmations

**Success Criteria**:
- [ ] Calendar displays events
- [ ] Google Calendar synced (two-way)
- [ ] Owners can be booked by users
- [ ] Email reminders sent

**Technical Stack**:
- React Big Calendar or FullCalendar
- Composio for Google Calendar API
- Resend for email notifications

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-4-calendar-system-week-12-13)

---

### Phase 5: Community Chat (Durable Objects) 📅 PLANNED

**Duration**: Weeks 14-16
**Status**: 📅 0% (Starts Week 14)

**Goal**: Real-time user-to-user messaging with WebSockets

**Features**:
1. **Durable Objects Setup** (Week 14)
   - DO classes for conversations
   - WebSocket connection handling
   - Auto-persistence to SQLite

2. **Direct Messages** (Week 15)
   - 1-on-1 chat
   - Message history
   - Real-time delivery (<100ms)

3. **Group Chats** (Week 15-16)
   - Multi-user conversations
   - Member management

4. **Real-time Features** (Week 16)
   - Typing indicators ("User is typing...")
   - Read receipts ("Delivered", "Read")
   - Online/offline status
   - Message reactions

**Why Durable Objects** (Ben's recommendation):
- ✅ Built-in 10GB SQLite per conversation
- ✅ Automatic persistence (no manual save code)
- ✅ WebSocket connections built-in
- ✅ <100ms message delivery
- ✅ Strong consistency guarantees

**Success Criteria**:
- [ ] DMs working in real-time
- [ ] Group chats functional
- [ ] Typing indicators live
- [ ] Messages deliver in < 100ms
- [ ] Read receipts accurate

**Durable Object Architecture**:
```typescript
// One DO per conversation
export class ConversationDO {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;  // Built-in SQLite
    this.participants = new Map();  // WebSocket connections
  }

  async handleMessage(message) {
    // Auto-save to SQLite
    await this.storage.put(`msg-${Date.now()}`, message);

    // Broadcast to all participants
    for (const [userId, socket] of this.participants) {
      socket.send(JSON.stringify(message));
    }
  }
}
```

**Reference**:
- [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-5-community-chat-weeks-14-16)
- [`nov7-update.md`](./nov7-update.md#tier-4-durable-objects-real-time-state)

---

### Phase 6: Artifacts Polish 📅 PLANNED

**Duration**: Weeks 17-18
**Status**: 📅 0% (Starts Week 17)

**Goal**: Add deploy/export features for AI-generated artifacts

**Current State**: ✅ Artifacts work (preview, download, copy)

**Enhancements Needed**:
1. **Vercel Deploy** (Week 17)
   - One-click deployment of HTML artifacts
   - Generate deployment URLs

2. **Google Docs Export** (Week 17)
   - Export text/markdown artifacts
   - Via Composio integration

3. **GitHub Gist Export** (Week 18)
   - Share code snippets
   - Public/private gists

4. **Artifact Gallery** (Week 18)
   - Browse all generated artifacts
   - Search and filter
   - Versioning

**Success Criteria**:
- [ ] Artifacts deploy to Vercel with one click
- [ ] Export to Google Docs works
- [ ] GitHub Gist export works
- [ ] Artifact gallery browsable
- [ ] Artifact versions tracked

**Reference**: [`Nov-7-Next.md`](./Nov-7-Next.md#-phase-6-artifacts-polish-week-17-18)

---

## 🔐 Infrastructure Implementation Status

### Tier 1: Neon Postgres ✅ Complete
**Status**: Production-ready

**Implemented**:
- ✅ Multi-tenant schema with `tenant_id` on all tables
- ✅ Drizzle ORM for type-safe queries
- ✅ Better Auth integration
- ✅ Users, organizations, members tables
- ✅ Logo/favicon fields in organization table

**Connection String**: Stored in `.dev.vars` (local) + Cloudflare Secrets (production)

**When to Use**:
- User accounts & profiles
- Organization settings
- Billing & subscription data
- AI chat history (archived)
- Analytics & metrics

**Reference**: [`nov7-update.md`](./nov7-update.md#tier-1-neon-postgres-structured-data)

---

### Tier 2: Cloudflare Vectorize ⏳ Next (Phase 2)
**Status**: Not started - planned for Week 8

**Purpose**: RAG (Retrieval Augmented Generation) with semantic search

**Will Store**:
- Document embeddings (chunked text)
- Knowledge base vectors
- Semantic search indices

**When to Use**:
- "Find documents similar to this query"
- RAG context retrieval for AI agents
- Semantic search across knowledge bases

**Ben's Guidance**: "Use Cloudflare AI search (Vectorize) for RAG - this is the way"

**Implementation Plan**:
1. Create Vectorize namespace
2. Document upload to R2
3. Text extraction and chunking
4. Embedding generation (Cloudflare Workers AI)
5. Vector storage (multi-tenant scoped)
6. RAG integration with AI chat

**Reference**: [`nov7-update.md`](./nov7-update.md#tier-2-cloudflare-vectorize-vector-embeddings)

---

### Tier 3: Cloudflare R2 🔄 Partially Complete
**Status**: Logo/favicon working, documents pending

**Implemented**:
- ✅ `app-assets` bucket configured
- ✅ Logo upload (`logos/` folder)
- ✅ Favicon upload (`favicons/` folder)
- ✅ Public URL generation via R2.dev
- ✅ File validation (size limits)

**Pending**:
- ⏳ User profile picture uploads
- ⏳ Document uploads for RAG
- ⏳ Message attachments (Phase 5)

**When to Use**:
- Files > 1MB
- Public URLs needed
- Images, documents, media

**Folder Structure**:
```
app-assets/
├── logos/
│   └── {orgId}-{timestamp}.{ext}
├── favicons/
│   └── {orgId}-{timestamp}.{ext}
├── documents/       (Phase 2 - RAG)
├── profiles/        (Phase 2)
└── attachments/     (Phase 5 - Chat)
```

**Reference**: [`nov7-update.md`](./nov7-update.md#tier-3-cloudflare-r2-object-storage)

---

### Tier 4: Durable Objects 📅 Future (Phase 5)
**Status**: Not started - planned for Week 14

**Purpose**: Real-time coordination, WebSockets, live messaging

**Will Store**:
- Community messenger conversations (DMs, groups)
- Active WebSocket connections
- Real-time message broadcasts
- Typing indicators (ephemeral)
- Online/offline presence
- Message delivery state

**Critical Features**:
- Built-in 10GB SQLite per conversation
- Automatic persistence (no manual save code needed)
- WebSocket connections built-in
- Strong consistency guarantees

**When to Use**:
- Real-time messaging (<100ms delivery)
- WebSocket coordination
- Typing indicators, read receipts
- Multi-device sync
- Live collaboration features

**Ben's Guidance**:
- "Use Durable Objects for agent state stuff - you can save messages there"
- "DO has 10GB node SQLite storage" (automatic persistence)
- "Great for chat, I use it for data sync and notifications"

**Implementation Plan** (Phase 5):
1. Create DO classes for conversations
2. WebSocket connection management
3. Message persistence to DO SQLite
4. Real-time broadcast logic
5. Typing indicators
6. Read receipts and presence
7. Periodic backup to Neon

**Reference**: [`nov7-update.md`](./nov7-update.md#tier-4-durable-objects-real-time-state)

---

## 📝 Decision & Risk Log

### Key Architectural Decisions

| Decision | Rationale | Source | Date |
|----------|-----------|--------|------|
| Use Neon Postgres instead of D1 | Better for relational data, pgvector support, ACID transactions | Initial architecture | Nov 1 |
| Use Vectorize for RAG | "This is the way" - production-ready, Cloudflare-native | Ben's guidance | Nov 7 |
| Use Durable Objects for chat | Built-in SQLite + WebSockets, simpler than external service | Ben's guidance | Nov 7 |
| Skip Agent SDK for AI chat | Vercel AI SDK sufficient, don't need DO persistence for single-user chats | Ben's guidance | Nov 7 |
| Use Composio for external tools | Pre-built integrations (100+ services), OAuth handling | Architecture review | Nov 5 |
| Use oRPC for custom tools | Auto-generate from API endpoints, type-safe tool calls | Architecture review | Nov 5 |

### Risk Register

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Email service integration delays | Medium | Medium | Start with Resend (simple API), backup is SendGrid | TBD |
| Vectorize learning curve | Medium | High | Start with simple RAG POC, consult Cloudflare docs | TBD |
| Durable Objects complexity | High | High | Build simple DM first, add features incrementally | TBD |
| Tool migration from LibreChat | Low | High | Document current tool implementations first | TBD |
| OAuth flow debugging | Medium | Medium | Use Composio's pre-built flows, avoid custom OAuth | TBD |
| Multi-tenant data leakage | Low | Critical | Audit all queries for `tenant_id` filtering | TBD |

---

## 🔗 Documentation Index

### Core Documentation
- **[MASTER-PLAN.md](./MASTER-PLAN.md)** ← You are here
- **[nov7-update.md](./nov7-update.md)** - Infrastructure architecture & Ben's guidance
- **[Nov-7-Next.md](./Nov-7-Next.md)** - Detailed implementation roadmap

### Technical References
- **[architecture.md](./architecture.md)** - System architecture, oRPC, Composio patterns
- **[features.md](./features.md)** - Complete feature catalog with migration strategies
- **[data-models.md](./data-models.md)** - Database schemas with Drizzle examples
- **[api-endpoints.md](./api-endpoints.md)** - API endpoint documentation
- **[migration-plan.md](./migration-plan.md)** - Phased migration strategy from LibreChat
- **[starter-integration.md](./starter-integration.md)** - Week-by-week integration guide
- **[tech-stack.md](./tech-stack.md)** - Technology decisions and comparisons

### Project Context
- **[README.md](./README.md)** - Project overview and quick facts
- **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** - Business context and why we're rebuilding
- **[QUICK_START.md](./QUICK_START.md)** - Getting started guide
- **[CROSS_REFERENCES.md](./CROSS_REFERENCES.md)** - Documentation cross-references

### Specialized Guides
- **[chat-guide.md](./chat-guide.md)** - AI chat implementation guide
- **[ui-ux.md](./ui-ux.md)** - UI/UX patterns and components
- **[token-guide.md](./token-guide.md)** - Token usage optimization
- **[pain-points.md](./pain-points.md)** - Problems with current LibreChat fork

---

## 🏆 Success Metrics & KPIs

### Phase Completion Criteria

#### Phase 0: Foundation ✅
- [x] Database connected and queryable
- [x] Authentication working (sign in/up)
- [x] Logo/favicon upload functional
- [x] Dev environment stable

#### Phase 1: God Tier (Target: Week 3)
- [ ] God dashboard displays all organizations
- [ ] Impersonation works without data leakage
- [ ] Owner invites create organizations automatically
- [ ] Email delivery > 99% success rate

#### Phase 2: Agents (Target: Week 7)
- [ ] 2+ custom agents created and tested
- [ ] Hybrid Offer tool generates valid offers
- [ ] Daily Client Machine tool produces content
- [ ] 3+ Composio tools integrated (GitHub, Gmail, Calendar)

#### Phase 3: LMS (Target: Week 11)
- [ ] 5+ modules with video content uploaded
- [ ] Tier restrictions prevent unauthorized access
- [ ] User progress tracked accurately
- [ ] Certificates generate on completion

#### Phase 4: Calendar (Target: Week 13)
- [ ] Events display in calendar view
- [ ] Google Calendar sync bidirectional
- [ ] Bookings create events successfully

#### Phase 5: Chat (Target: Week 16)
- [ ] DM delivery < 100ms (P95)
- [ ] Typing indicators < 200ms latency
- [ ] Read receipts accurate
- [ ] Zero message loss

#### Phase 6: Artifacts (Target: Week 18)
- [ ] Artifacts deploy to Vercel successfully
- [ ] Google Docs export preserves formatting
- [ ] GitHub Gist creation works
- [ ] Artifact gallery searchable

---

### Technical Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (P95) | < 200ms | Cloudflare Analytics |
| Database Query Time (P95) | < 50ms | Neon metrics |
| Chat Message Delivery | < 100ms | Durable Objects metrics |
| Vector Search Latency | < 300ms | Vectorize analytics |
| R2 File Upload | < 2s for 5MB | R2 metrics |
| Page Load Time (LCP) | < 2.5s | Lighthouse |

---

### Business Success Metrics

| Metric | Week 1 Target | Week 18 Target |
|--------|---------------|----------------|
| God Dashboard Usage | 1 user (God) | 1 user |
| Organizations Created | 0 | 10 |
| Total Users | 5 (team) | 100 |
| Custom Agents Created | 0 | 50 |
| LMS Modules Completed | 0 | 200 |
| Chat Messages Sent | 0 | 10,000 |
| Artifacts Generated | 50 | 5,000 |

---

## 📊 Project Timeline Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOLO:OS REBUILD - 18 WEEK TIMELINE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Nov 7     Week 1-3         Week 4-7           Week 8-11        Week 12-13  │
│    │          │                │                  │                 │       │
│    ▼          ▼                ▼                  ▼                 ▼       │
│  [Phase 0]  [Phase 1]      [Phase 2]          [Phase 3]        [Phase 4]   │
│  Foundation  God Tier      Agents & Tools      LMS System        Calendar   │
│     ✅         🔄              ⏳                  📅                📅      │
│                                                                             │
│  Week 14-16        Week 17-18          Final                                │
│      │                 │                 │                                  │
│      ▼                 ▼                 ▼                                  │
│  [Phase 5]         [Phase 6]        [Launch]                                │
│  Real-time Chat    Artifacts         Feb 2025                               │
│      📅                📅               🎯                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Start Date**: November 7, 2024
**Target Completion**: February 2025 (18 weeks)
**Current Status**: Week 1, Phase 1 - God Tier & Multi-Tenancy

---

## 🚀 Next Actions

### Immediate (This Week - Week 1)
1. **Build God Dashboard UI**
   - Create `/god-dashboard` route
   - Display all organizations with metrics
   - Add search/filter functionality

2. **Start Impersonation System**
   - Design middleware for org context switching
   - Create impersonation banner component

3. **Setup Email Integration**
   - Choose between Resend or SendGrid
   - Setup API keys
   - Test email sending

### Short-term (Weeks 2-3)
1. **Complete Impersonation**
   - Test with multiple organizations
   - Security audit for data leakage

2. **Complete Owner Invite System**
   - Build invite generation UI
   - Create signup flow with token
   - Test auto-org creation

### Medium-term (Month 2)
1. **Start Agent Builder (Phase 2)**
   - Design agent configuration UI
   - Setup Vercel AI SDK for agent execution
   - Build tool selector component

---

## 📝 Update Log

| Date | Update | Author |
|------|--------|--------|
| 2024-11-07 | Initial MASTER PLAN created | Claude Code |
| TBD | Phase 1 Week 1 complete | TBD |
| TBD | Phase 1 fully complete | TBD |

---

**Document Owner**: Dan (God User)
**Last Review**: 2024-11-07
**Next Review**: After Week 1 completion
**Version**: 1.0

---

*This is a living document. Update progress weekly and review phase completion criteria bi-weekly.*
