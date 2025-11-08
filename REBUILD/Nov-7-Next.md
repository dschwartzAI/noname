📋 Next Up: Development Roadmap
Document Purpose
This section outlines the immediate development priorities for ShadFlareAi, organized by implementation phases. Based on current progress (Phase 0 complete, Phase 1 in progress) and informed by the REBUILD migration plan.

🎯 Phase 1: God Tier & Multi-Tenancy (Weeks 1-3)
1.1 Finalize God Tier Hierarchy ⚡ HIGH PRIORITY
Status: Database schema exists, needs UI implementation
Effort: 1 week
What needs to be done:

 Build God Dashboard UI (/god-dashboard route)
 Display all organizations with metrics (member count, tier, revenue)
 Add organization filtering and search
 Quick actions: suspend, upgrade tier, delete
 System-wide analytics dashboard

Technical implementation:
typescript// God-only API endpoint (already in REBUILD docs)
app.get('/api/god/organizations', requireGod, async (c) => {
  const orgs = await db.query.organization.findMany({
    with: {
      members: { with: { user: true } },
      _count: { messages: true, conversations: true }
    }
  });
  return c.json(orgs);
});
Reference: See MULTI_TENANT_SETUP.md and WHATS_NEXT.md for complete implementation guide.

1.2 Impersonation System ⚡ HIGH PRIORITY
Purpose: God user can view app as any organization owner
Effort: 3 days
Features:

 "View as Owner" button in God Dashboard
 Switch active organization context
 See exactly what owner sees (chats, agents, settings)
 Visual indicator when impersonating (banner)
 Easy switch back to God view

Implementation approach:
typescript// Middleware for impersonation
app.use('/api/*', async (c, next) => {
  const { user } = await auth.api.getSession();
  
  if (user?.isGod && c.req.header('X-Impersonate-Org')) {
    const orgId = c.req.header('X-Impersonate-Org');
    c.set('orgId', orgId);
    c.set('isImpersonating', true);
  }
  
  await next();
});
UI component:
tsx// Impersonation banner
{isImpersonating && (
  <div className="bg-yellow-500 text-black px-4 py-2">
    ⚠️ Viewing as: {organization.name} 
    <Button onClick={exitImpersonation}>Exit Impersonation</Button>
  </div>
)}

1.3 Owner Invite System via Email ⚡ HIGH PRIORITY
Purpose: God can invite organization owners with secret signup links
Effort: 4 days
Flow:

God sends invite email with unique token
Recipient clicks link → pre-filled signup form
After account creation → automatically becomes owner of new org
Organization pre-configured with tier/settings

Tasks:

 Generate unique invite tokens (store in database)
 Email template with branded invite link
 Custom signup route that accepts token (/signup/:token)
 Auto-create organization after signup
 Set invitee as owner role
 Mark invite as used

Database addition:
sqlCREATE TABLE owner_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  organization_preset JSONB,  -- pre-configured org settings
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_by TEXT REFERENCES user(id)
);
Email integration:

Use Better Auth email provider OR
Integrate Resend/SendGrid for transactional emails


🤖 Phase 2: Agent & Tool Builder (Weeks 4-7)
2.1 Agent Builder UI ⚡ HIGH PRIORITY
Purpose: Visual interface for owners to create custom AI agents
Effort: 2 weeks
Reference: REBUILD/features.md - Section 2.2
Features:

 Agent configuration form:

Name, description, avatar
System prompt editor (with markdown preview)
Model selection (GPT-4, Claude, Grok)
Temperature, max tokens settings


 Tool selector (checkboxes for available tools)
 Knowledge base uploader (files for RAG)
 Preview mode (test agent before saving)
 Agent library (all created agents)

Tech stack:

Vercel AI SDK for agent execution
oRPC for custom tool generation
Composio for external integrations

Implementation:
tsx// Agent builder form
<Form>
  <Input name="name" label="Agent Name" />
  <Textarea name="systemPrompt" label="Instructions" />
  <Select name="model" options={['gpt-4', 'claude-3.5', 'grok']} />
  
  <ToolSelector>
    {/* Custom tools from oRPC */}
    <Checkbox value="search_database" />
    <Checkbox value="hybrid_offer_printer" />
    
    {/* External tools from Composio */}
    <Checkbox value="GITHUB_CREATE_ISSUE" />
    <Checkbox value="GMAIL_SEND_EMAIL" />
  </ToolSelector>
  
  <FileUpload accept=".pdf,.txt,.csv" label="Knowledge Base" />
  <Button onClick={testAgent}>Test Agent</Button>
</Form>

2.2 Tool Builder (oRPC + Custom Tools) 🚀 MEDIUM PRIORITY
Purpose: Let owners create custom tools for their agents
Effort: 1.5 weeks
Pre-built tools to migrate from LibreChat:

 Hybrid Offer Printer - Generate high-converting offers
 Daily Client Machine - Content generation for clients
 Database query tool (search user data)
 Memory retrieval tool (business context)

Custom tool creation:

 Visual tool builder UI
 Define tool schema (inputs, outputs)
 Write tool logic (code editor or no-code)
 Test tool execution
 Publish tool to agent

oRPC integration:
typescript// Auto-generate tool from API endpoint
import { generateTools } from 'orpc-tools';

const tools = generateTools({
  endpoints: [
    {
      name: 'hybrid_offer_printer',
      description: 'Creates compelling offers for coaching programs',
      path: '/api/tools/hybrid-offer',
      method: 'POST',
      inputSchema: z.object({
        targetAudience: z.string(),
        painPoints: z.array(z.string()),
        transformationPromise: z.string()
      })
    }
  ]
});
Composio for external tools:

GitHub, Gmail, Google Calendar, Notion, Slack
Pre-built integrations (100+ services)
OAuth flow for user authentication


📚 Phase 3: Learning Management System (Weeks 8-11)
3.1 LMS Module System ⏳ MEDIUM PRIORITY
Purpose: Course modules with video content and progress tracking
Effort: 2 weeks
Reference: REBUILD/features.md - Section 5
Database schema:
sqlCREATE TABLE modules (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organization(id),
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER,
  tier_required TEXT  -- 'free', 'pro', 'enterprise'
);

CREATE TABLE sub_modules (
  id TEXT PRIMARY KEY,
  module_id TEXT REFERENCES modules(id),
  title TEXT NOT NULL,
  video_url TEXT,  -- Stream video URL
  transcript TEXT,
  order_index INTEGER,
  duration_minutes INTEGER
);

CREATE TABLE user_progress (
  user_id TEXT REFERENCES user(id),
  sub_module_id TEXT REFERENCES sub_modules(id),
  completed_at TIMESTAMP,
  watch_time_seconds INTEGER,
  PRIMARY KEY (user_id, sub_module_id)
);
Features:

 Module management UI (create, edit, reorder)
 Sub-module creation with video upload
 Tier-based access restrictions
 Progress tracking per user
 Certificate generation on completion
 Video player with transcript

Stream Video integration:

Upload recordings
Transcription API
Video playback with resume functionality


3.2 Tier-Based Access Control
Purpose: Restrict modules by user subscription tier
Effort: 3 days
Implementation:
typescript// Middleware for module access
export async function checkModuleAccess(moduleId: string, userId: string) {
  const module = await db.query.modules.findFirst({ 
    where: eq(modules.id, moduleId) 
  });
  
  const member = await db.query.member.findFirst({
    where: eq(member.userId, userId),
    with: { organization: true }
  });
  
  const userTier = member.organization.metadata.tier || 'free';
  const tierHierarchy = ['free', 'pro', 'enterprise'];
  
  if (tierHierarchy.indexOf(userTier) < tierHierarchy.indexOf(module.tierRequired)) {
    throw new Error('Upgrade required');
  }
}
UI:

Lock icon on restricted modules
Upgrade CTA for locked content
Tier badge on each module


📅 Phase 4: Calendar System (Week 12-13)
4.1 Calendar Integration ⏳ MEDIUM PRIORITY
Purpose: Schedule coaching sessions, reminders, events
Effort: 1 week
Reference: REBUILD/features.md - Section 8
Features:

 Calendar view (month, week, day)
 Create events
 Google Calendar sync (via Composio)
 Booking system for owners
 Email reminders
 Timezone handling

Tech stack:

React Big Calendar or FullCalendar
Composio for Google Calendar API
Email notifications via Resend

Database:
sqlCREATE TABLE events (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organization(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  attendees JSONB,  -- array of user IDs
  google_event_id TEXT,  -- for sync
  created_by TEXT REFERENCES user(id)
);

💬 Phase 5: Community Chat (Weeks 14-16)
5.1 Real-Time Messaging with Durable Objects 🔥 HIGH PRIORITY
Purpose: User-to-user DMs and group chats within organizations
Effort: 2 weeks
Reference: Infrastructure doc - "Community Messenger → Durable Objects"
Why Durable Objects (Ben's recommendation):

Built-in 10GB SQLite per conversation
Automatic persistence (no manual save code)
WebSocket connections built-in
<100ms message delivery
Perfect for real-time chat

Features:

 Inbox UI (contact list, conversations)
 Direct messages (1-on-1)
 Group chats
 Typing indicators ("Taylor is typing...")
 Read receipts ("Delivered", "Read")
 Online/offline status
 Message attachments (R2 storage)
 Message search
 Emoji reactions

Durable Object architecture:
typescript// One DO per conversation
export class ConversationDO {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;  // Built-in SQLite
    this.participants = new Map();  // WebSocket connections
  }
  
  async handleMessage(message) {
    // Auto-save to SQLite
    await this.storage.put(`msg-${Date.now()}`, message);
    
    // Broadcast to all connected participants
    for (const [userId, socket] of this.participants) {
      socket.send(JSON.stringify(message));
    }
  }
  
  async fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }
  }
}
Alternative (simpler, no real-time):

Start with HTTP polling (check for messages every 10s)
Migrate to Durable Objects later if users complain about delays
Uses just Neon Postgres, no WebSockets

Decision point: Real-time (DO) vs Async (Polling)?

Real-time: Better UX, more complex
Async: Simpler, good enough for low-volume messaging


🎨 Phase 6: Artifacts Polish (Week 17-18)
6.1 Artifact Actions & Export ⏳ LOW PRIORITY
Purpose: Deploy artifacts, push to Google Docs, GitHub
Effort: 1 week
Reference: REBUILD/features.md - Section 3.2, ARTIFACT_TESTING_SUMMARY.md
Current state: ✅ Artifacts work (preview, download, copy)
Enhancements needed:

 Deploy to Vercel - One-click deployment of HTML artifacts
 Push to Google Docs - Export text/markdown artifacts
 Push to GitHub Gist - Share code snippets
 Artifact gallery - Browse all generated artifacts
 Artifact versioning - Track revisions
 Artifact templates - Pre-built starting points

Implementation (Vercel deployment):
typescript// API endpoint
app.post('/api/artifacts/deploy', async (c) => {
  const { name, code } = await c.req.json();
  
  const vercel = new Vercel({ accessToken: process.env.VERCEL_TOKEN });
  
  const deployment = await vercel.deployments.create({
    name: `artifact-${name}`,
    files: [{ file: 'index.html', data: code }],
    projectSettings: { framework: 'static' }
  });
  
  return c.json({ url: `https://${deployment.url}` });
});
Implementation (Google Docs export):
typescript// Via Composio
await composio.execute({
  userId,
  toolName: 'GDOCS_CREATE_DOCUMENT',
  params: {
    title: artifactName,
    content: artifactContent
  }
});

📊 Priority Matrix
PhaseFeaturePriorityEffortDependencies1God Dashboard🔥 HIGH1 weekNone1Impersonation🔥 HIGH3 daysGod Dashboard1Owner Invites🔥 HIGH4 daysEmail service2Agent Builder🔥 HIGH2 weeksPhase 0 complete2Tool Builder🚀 MEDIUM1.5 weeksoRPC setup3LMS Modules🚀 MEDIUM2 weeksStream integration3Tier Restrictions🚀 MEDIUM3 daysLMS modules4Calendar🚀 MEDIUM1 weekComposio5Community Chat🔥 HIGH2 weeksDurable Objects6Artifact Deploy⏳ LOW1 weekVercel API

🚀 Immediate Next Actions (This Week)
Week 1 Focus: God Tier & Multi-Tenancy

Build God Dashboard (/god-dashboard route)

Display all organizations
Add search/filter
Show metrics


Implement Impersonation

Add "View as Owner" button
Switch org context
Visual indicator banner


Create Owner Invite System

Database schema for invites
Generate unique tokens
Email template
Signup flow



After Week 1: Move to Agent Builder (Phase 2)

📚 Related Documentation
DocumentRelevant SectionsWhy Read ItMULTI_TENANT_SETUP.mdGod accounts, impersonation, org managementComplete implementation guide for Phase 1WHATS_NEXT.mdStep-by-step setup instructionsQuick reference for database setupREBUILD/features.mdAgent builder, LMS, artifactsFeature specifications and code examplesREBUILD/migration-plan.mdPhased approach, timelinesOverall project structureREBUILD/architecture.mdoRPC, Composio, system designTechnical architecture decisionsARTIFACT_TESTING_SUMMARY.mdCurrent artifact capabilitiesWhat's already done vs what's needed

✅ Success Criteria
Phase 1 Complete When:

 God can see all organizations in dashboard
 God can impersonate any owner
 God can send owner invite emails
 Invites create orgs automatically

Phase 2 Complete When:

 Owners can create custom agents
 Hybrid Offer Printer tool migrated
 Daily Client Machine tool migrated
 Tools integrated with oRPC

Phase 3 Complete When:

 Modules/sub-modules created
 Videos uploaded and playing
 Tier restrictions enforced
 Progress tracked per user

Phase 4 Complete When:

 Calendar displays events
 Google Calendar synced
 Bookings functional

Phase 5 Complete When:

 DMs working in real-time
 Group chats functional
 Typing indicators live
 Messages < 100ms delivery

Phase 6 Complete When:

 Artifacts deploy to Vercel
 Export to Google Docs works
 Artifact gallery browsable


Document Version: 1.0
Last Updated: 2024-11-07
Next Review: After Phase 1 completion
Owner: Dan (God user)