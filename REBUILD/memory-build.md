🎯 Next Steps: Phase 0C - Simple Memory (After Chat History Works)
Copy this EXACTLY to Claude Code when conversation history sidebar is complete:

Phase 0C: Simple Memory System (No Vectorize Yet)

Context:
- Conversation history with sidebar NOW WORKS ✅
- Users can see past chats, start new chats ✅
- Next: Add memory so AI remembers user business context across all conversations

Goal:
AI should remember things like:
- User's business type (coaching, consulting, etc.)
- Target audience (who they serve)
- Main offers (products, pricing)
- Business challenges
- Goals

This context should be included in EVERY AI conversation automatically.

Step 1: Database Migration
Create migration: database/migrations/0004_add_memories.sql

memories table:
- id (TEXT PRIMARY KEY)
- user_id (TEXT REFERENCES user(id) ON DELETE CASCADE)
- organization_id (TEXT REFERENCES organization(id) ON DELETE CASCADE)
- key (TEXT NOT NULL) - e.g. "business_type", "target_audience", "main_offer"
- value (TEXT NOT NULL) - the actual memory content
- category (TEXT) - "business", "offers", "audience", "challenges", "goals"
- source (TEXT DEFAULT 'manual') - "manual", "extracted", "conversation"
- created_at (TIMESTAMP DEFAULT NOW())
- updated_at (TIMESTAMP DEFAULT NOW())

Indexes:
- user_id, organization_id (for fast lookups)
- category (for grouping)

Show me the SQL and how to run it in Neon.

Step 2: Memory API Endpoints
Create /api/memories routes:

GET /api/memories
- List all memories for current user
- Group by category in response
- Order by category, then created_at DESC
- Return: { business: [...], offers: [...], audience: [...], challenges: [...], goals: [...] }

POST /api/memories
- Add new memory
- Body: { key, value, category }
- Auto-set: user_id, organization_id from session
- Validate: key and value required, category must be valid

PATCH /api/memories/:id
- Update memory value or category
- Only allow if memory belongs to current user

DELETE /api/memories/:id
- Remove memory
- Only allow if memory belongs to current user

Use existing auth middleware and organization scoping pattern.

Step 3: Inject Memories into AI Chat
Update /api/chat endpoint:

Before calling AI model:
1. Fetch memories for current user:
   const memories = await db.query.memories.findMany({
     where: and(
       eq(memories.userId, userId),
       eq(memories.organizationId, orgId)
     ),
     orderBy: [asc(memories.category), desc(memories.createdAt)]
   });

2. Group memories by category:
   const grouped = memories.reduce((acc, m) => {
     if (!acc[m.category]) acc[m.category] = [];
     acc[m.category].push(`${m.key}: ${m.value}`);
     return acc;
   }, {});

3. Format memory context:
   const memoryContext = memories.length > 0 
     ? `\n\nUSER BUSINESS CONTEXT:\n${Object.entries(grouped)
         .map(([cat, items]) => `${cat.toUpperCase()}:\n${items.map(i => `- ${i}`).join('\n')}`)
         .join('\n\n')}`
     : '';

4. Append to system prompt:
   const systemPrompt = `${tool.systemPrompt}${memoryContext}`;

5. Use in AI call:
   const result = await streamText({
     model: openai(tool.model),
     system: systemPrompt,
     messages
   });

This way AI sees user context in every conversation.

Step 4: Memory Management UI
Create page: /settings/memory

Layout:
1. Header:
   - Title: "Business Memory"
   - Description: "Store information about your business so AI always remembers"
   - "Add Memory" button (opens dialog)

2. Memory Categories (use Tabs):
   - Business Info
   - Target Audience
   - Offers
   - Challenges
   - Goals

3. For each category tab:
   - List current memories in that category
   - Each memory card shows:
     * Key (bold)
     * Value
     * Edit button (inline edit)
     * Delete button (with confirm)
   - Empty state: "No {category} memories yet"

4. Add Memory Dialog:
   - Category dropdown (select from 5 categories)
   - Key input (text)
   - Value textarea
   - Save button
   - Cancel button

5. Quick Start Templates (optional):
   - "Business Type": [input]
   - "Target Audience": [input]  
   - "Main Offer": [input]
   - "Starting Price": [input]
   - Quick save button (creates 4 memories at once)

Use Shadcn: Tabs, Card, Dialog, Input, Textarea, Button
Wire to /api/memories endpoints
Add to settings navigation sidebar

Step 5: Test Flow
1. User goes to /settings/memory
2. Adds memories:
   - Business Type: "Coaching for real estate agents"
   - Target Audience: "Agents making $50K-$150K/year"
   - Main Offer: "1:1 coaching program at $5K"
3. User starts new chat
4. AI response should reference their business context
5. User updates memory
6. Next AI response uses updated context

Success Criteria:
✅ Can add/edit/delete memories in settings
✅ Memories grouped by category
✅ AI system prompt includes memories
✅ AI responds with user-specific context
✅ Memory changes reflect immediately in next chat
✅ Multi-tenant: only see your org's memories

Tech Stack:
- Neon Postgres + Drizzle ORM
- Existing auth + organization middleware
- Shadcn UI components
- TanStack Query for data fetching

Start with Step 1: database migration.
After that works, do Step 2: API endpoints.
Then Step 3: inject into chat.
Finally Step 4: UI.

Note: We'll add semantic search with Vectorize later in Phase 2B.
For now, this simple version includes ALL memories in every chat.

🎯 What This Gives You
Immediate benefits:

✅ AI remembers user business context
✅ Personalized responses every chat
✅ No external dependencies
✅ No monthly costs
✅ Multi-tenant ready
✅ 2-3 hours to build

Later enhancement (Phase 2B - after Tool Builder):

Add Vectorize setup
Semantic search for relevant memories
Only inject top 5 relevant memories (not all)
More efficient, better context


📋 Implementation Timeline
StepTimeOutputStep 1: Migration15 minMemories table existsStep 2: API1 hourCRUD endpoints workStep 3: Inject into chat30 minAI sees memoriesStep 4: UI1.5 hoursSettings page worksStep 5: Test15 minE2E flow worksTotal3 hours✅ Memory system complete

✅ Success Checklist
After you finish, you should be able to:

 Go to /settings/memory
 Add memory: "Business Type: Real estate coaching"
 Add memory: "Target Audience: New agents"
 Start new chat
 AI mentions your business type in response
 Update memory to "Target Audience: Experienced agents"
 Start another chat
 AI uses updated audience info


After this works, THEN we'll build Tool Builder (Phase 2A).