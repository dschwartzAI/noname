🎯 Phase 0C - Memory System Implementation Plan

## ✅ COMPLETED: Basic Memory System (Phase 1B)

**Status**: ✅ Implemented and tested on [current date]

**What was built:**
1. ✅ Database table (`memories`) with multi-tenant isolation
2. ✅ CRUD API endpoints (`/api/v1/memories`)
3. ✅ Memory injection into AI chat system prompt
4. ⏭️ Memory Management UI (skipped - to be built later)
5. ✅ End-to-end testing with real data

**Current capabilities:**
- AI remembers user business + personal context across all conversations
- Multi-tenant data isolation (organizationId + userId)
- 7 categories: business_info, target_audience, offers, current_projects, challenges, goals, personal_info
- Auto-extraction from conversations (learns as you chat)
- First-message-only injection (50-80% token savings)
- Memories persist in Neon Postgres with source tracking (manual/auto/agent)

---

## 🚀 NEXT: Memory System Optimization & Auto-Learning

═══════════════════════════════════════════════
### STEP 1: OPTIMIZE MEMORY INJECTION (First Message Only)
═══════════════════════════════════════════════

**Goal**: Only inject business memories on the first message of a conversation to save tokens.

**Context**: AI conversation history includes all previous messages, so the system message from message 1 remains available throughout the entire conversation. Only need to inject once.

**File**: `src/server/routes/chat.ts`

**Current behavior:**
- Memories are fetched and injected on every message (wasteful)

**New behavior:**
- Memories injected ONLY on first message
- Messages 2+ rely on conversation history (system message persists)

**Implementation:**

```typescript
// Find where memories are currently being fetched and injected
// Should be around the streamText() or generateText() call

// Add this logic:
const isFirstMessage = messages.length === 1

// Fetch memories only if first message
let memoryContext = ''
if (isFirstMessage) {
  const userMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, user.id),
        eq(memories.organizationId, organizationId)
      )
    )
    .orderBy(asc(memories.category), desc(memories.createdAt))

  // Format memories by category
  if (userMemories.length > 0) {
    const categories = {
      business_info: 'Business Information',
      target_audience: 'Target Audience',
      offers: 'Offers & Services',
      current_projects: 'Current Projects',
      challenges: 'Challenges & Pain Points',
      goals: 'Goals & Objectives',
      personal_info: 'Personal Context',
    }

    let formatted = '\n\n═══ USER BUSINESS CONTEXT ═══\n'

    for (const [categoryKey, categoryLabel] of Object.entries(categories)) {
      const categoryMemories = userMemories.filter(m => m.category === categoryKey)
      if (categoryMemories.length > 0) {
        formatted += `\n${categoryLabel}:\n`
        categoryMemories.forEach(mem => {
          formatted += `  • ${mem.key}: ${mem.value}\n`
        })
      }
    }

    formatted += '\n═══════════════════════════════'
    memoryContext = formatted
  }
}

// Inject if first message
if (memoryContext && isFirstMessage) {
  messages = [
    {
      role: 'system',
      content: `You are a helpful AI assistant. You have access to the user's business context which will help you provide more personalized and relevant responses.${memoryContext}`,
    },
    ...messages,
  ]
  console.log('💭 Injected business context (first message of conversation)')
} else if (isFirstMessage) {
  console.log('ℹ️  No business memories found for this user')
} else {
  console.log('⏭️  Skipping memory injection (not first message - using conversation history)')
}
```

---

═══════════════════════════════════════════════
### STEP 2: AUTO-EXTRACT MEMORIES FROM CONVERSATIONS
═══════════════════════════════════════════════

**Goal**: Automatically learn business facts from conversations and save as structured memories.

**Categories to extract:**
- `business_info`: Business type, industry, company name
- `target_audience`: Who they serve, demographics, psychographics
- `offers`: Products, services, pricing, packages
- `current_projects`: What they're actively working on (can be multiple)
- `challenges`: Pain points, obstacles, problems (both immediate and general)
- `goals`: Objectives, targets, aspirations
- `personal_info`: Family, hobbies, interests (only if naturally mentioned, not intrusive)

**File**: `src/server/routes/chat.ts`

**Location**: Inside the `onFinish` callback of `streamText()`

**Implementation:**

```typescript
onFinish: async ({ text, usage, response }) => {
  try {
    // 1. Save assistant message (keep existing logic)
    const assistantMessageId = nanoid()
    await db.insert(authSchema.message).values({
      id: assistantMessageId,
      conversationId: currentConversationId,
      organizationId,
      role: 'assistant',
      content: text,
      createdAt: new Date(),
    })

    console.log('💾 Saved assistant message')

    // 2. AUTO-EXTRACT MEMORIES (NEW)
    // Only run extraction after a few messages to avoid waste on "hi" convos
    const messageCountResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(authSchema.message)
      .where(eq(authSchema.message.conversationId, currentConversationId))

    const messageCount = messageCountResult[0].count

    // Trigger extraction after 3+ messages
    if (messageCount >= 3) {
      console.log('🧠 Starting memory auto-extraction...')

      // Get recent conversation history for context
      const recentMessages = await db
        .select()
        .from(authSchema.message)
        .where(eq(authSchema.message.conversationId, currentConversationId))
        .orderBy(desc(authSchema.message.createdAt))
        .limit(10) // Last 10 messages for context

      // Build conversation context
      const conversationContext = recentMessages
        .reverse()
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n')

      // Extraction prompt
      const extractionPrompt = `Analyze this conversation and extract any NEW business facts about the user that should be remembered long-term.

CONVERSATION HISTORY:
${conversationContext}

EXTRACTION RULES:
1. Only extract factual information explicitly stated by the USER (not AI responses or assumptions)
2. Focus on business context, not personal chat or casual conversation
3. Categories:
   - business_info: Business type, industry, company name, business model
   - target_audience: Who they serve, customer demographics, ideal client profile
   - offers: Products, services, pricing, packages, programs
   - current_projects: What they're actively working on RIGHT NOW (specific projects in progress)
   - challenges: Immediate problem they're trying to solve RIGHT NOW
   - challenges: General pain points, obstacles, problems they face
   - goals: Business objectives, targets, aspirations, what they want to achieve

4. Be specific and concise in values
5. Only extract if explicitly mentioned by user
6. For "current_projects" and "challenges" - only extract if they mention something happening NOW

OUTPUT FORMAT (JSON only, no explanation):
{
  "memories": [
    {
      "category": "business_info",
      "key": "Business Type",
      "value": "Real estate coaching"
    },
    {
      "category": "current_projects",
      "key": "Active Project",
      "value": "Launching new agent onboarding program in Q2"
    },
    {
      "category": "challenges",
      "key": "Immediate Challenge",
      "value": "Struggling to generate qualified leads for high-ticket coaching"
    }
  ]
}

If no business facts found, return: {"memories": []}

RESPOND WITH ONLY VALID JSON, NO MARKDOWN, NO EXPLANATION:`

      // Make extraction call (use same model as chat)
      const extractionResult = await generateText({
        model: aiModel,
        prompt: extractionPrompt,
        temperature: 0.1, // Low temperature for consistent, accurate extraction
      })

      console.log('🔍 Raw extraction result:', extractionResult.text)

      // Parse extraction result
      let extractedMemories: Array<{ category: string; key: string; value: string }> = []
      try {
        // Clean up response (remove markdown code blocks if present)
        let cleanedText = extractionResult.text.trim()
        cleanedText = cleanedText.replace(/```json\n?/g, '')
        cleanedText = cleanedText.replace(/```\n?/g, '')
        cleanedText = cleanedText.trim()

        const parsed = JSON.parse(cleanedText)
        extractedMemories = parsed.memories || []
      } catch (parseError) {
        console.error('❌ Failed to parse extraction result:', parseError)
        console.error('Raw text was:', extractionResult.text)
      }

      if (extractedMemories.length > 0) {
        console.log(`✨ Extracted ${extractedMemories.length} potential memories`)

        // 3. CHECK FOR DUPLICATES & SAVE
        for (const memory of extractedMemories) {
          // Validate category
          const validCategories = [
            'business_info',
            'target_audience',
            'offers',
            'current_projects',
            'challenges',
            'challenges',
            'goals'
          ]

          if (!validCategories.includes(memory.category)) {
            console.warn(`⚠️  Skipping invalid category: ${memory.category}`)
            continue
          }

          // Check if similar memory already exists (same user, org, category, key)
          const [existing] = await db
            .select()
            .from(memories)
            .where(
              and(
                eq(memories.userId, user.id),
                eq(memories.organizationId, organizationId),
                eq(memories.category, memory.category),
                eq(memories.key, memory.key)
              )
            )
            .limit(1)

          if (existing) {
            // Update if value changed
            if (existing.value !== memory.value) {
              await db
                .update(memories)
                .set({
                  value: memory.value,
                  source: 'auto',
                  updatedAt: new Date(),
                })
                .where(eq(memories.id, existing.id))

              console.log(`🔄 Updated memory: [${memory.category}] ${memory.key} = ${memory.value}`)
            } else {
              console.log(`⏭️  Memory unchanged: [${memory.category}] ${memory.key}`)
            }
          } else {
            // Insert new memory
            await db.insert(memories).values({
              id: nanoid(),
              userId: user.id,
              organizationId: organizationId,
              key: memory.key,
              value: memory.value,
              category: memory.category,
              source: 'auto', // Mark as auto-extracted
              createdAt: new Date(),
              updatedAt: new Date(),
            })

            console.log(`💾 Saved new memory: [${memory.category}] ${memory.key} = ${memory.value}`)
          }
        }
      } else {
        console.log('⏭️  No new business facts to extract from this conversation')
      }
    } else {
      console.log(`⏭️  Skipping extraction (only ${messageCount} messages, need 3+)`)
    }

  } catch (error) {
    console.error('❌ Error in onFinish:', error)
  }
}
```

**Required imports:**
- Add to top of file if not present: `import { generateText } from 'ai'`
- Add: `import { sql } from 'drizzle-orm'`

---

═══════════════════════════════════════════════
### TESTING STEPS 1-2
═══════════════════════════════════════════════

**Test 1: First-message injection**
1. Start dev server
2. Start new chat conversation
3. Send: "Hi"
4. Check logs: Should see "💭 Injected business context (first message of conversation)"
5. Send: "What's 2+2?"
6. Check logs: Should see "⏭️ Skipping memory injection (not first message - using conversation history)"
7. Send: "Help me with my business"
8. AI should still have business context (proves conversation history works)

**Test 2: Auto-extraction**
1. Start new conversation
2. Send message 1: "Hi, I need help with my coaching business"
3. Send message 2: "I run a real estate coaching program"
4. Send message 3: "Right now I'm launching a new onboarding program for agents"
5. Send message 4: "My biggest challenge is generating qualified leads"
6. Check logs after message 3-4:
   - Should see "🧠 Starting memory auto-extraction..."
   - Should see "✨ Extracted X potential memories"
   - Should see "💾 Saved new memory: [business_info] Business Type = Real estate coaching program"
   - Should see "💾 Saved new memory: [current_projects] Active Project = Launching new onboarding program for agents"
   - Should see "💾 Saved new memory: [challenges] Immediate Challenge = Generating qualified leads"

**Test 3: Memory persistence across conversations**
1. Close chat, wait 5 seconds
2. Start NEW conversation
3. Send: "What do I do?"
4. AI should respond with knowledge of your real estate coaching business
5. Send: "What am I working on right now?"
6. AI should mention your onboarding program launch

**Test 4: Memory updates (not duplicates)**
1. New conversation
2. Say: "I run a bakery"
3. Wait for extraction
4. Check DB: Should have "Business Type: bakery"
5. Say: "Actually, I run a bakery in Brooklyn specializing in sourdough"
6. Wait for extraction
7. Check DB: Should UPDATE (not duplicate) to "Business Type: bakery in Brooklyn specializing in sourdough"

---

═══════════════════════════════════════════════
### STEP 3: CONVERSATION SEARCH WITH VECTORIZE (PLAN FOR NEXT)
═══════════════════════════════════════════════

**Don't implement this yet** - just the plan below after completing Steps 1-2.

**GOAL**: Enable semantic search across ALL past conversations so users can find and reference previous discussions.

**Use case:**
- User: "What did we discuss about my Brooklyn office last month?"
- System searches past conversations semantically
- Returns relevant conversation from Feb 15
- AI includes that context in response

**Architecture:**
1. **Vectorize every message when saved** (in onFinish)
   - Create embedding using text-embedding-3-small
   - Store in Cloudflare Vectorize with metadata (conversationId, userId, organizationId)

2. **Create conversation search endpoint**
   - POST /api/v1/conversations/search
   - Takes query, returns semantically similar past conversations
   - Filters by user + org for multi-tenant security

3. **Auto-detect when to search past conversations**
   - Look for keywords like "remember", "discussed", "talked about", "last time"
   - Automatically search and include relevant context

4. **Setup Vectorize in wrangler.toml**
   - Create index with 1536 dimensions (for text-embedding-3-small)
   - Configure bindings

**Implementation checklist for Step 3:**
- ☐ Set up Cloudflare Vectorize index
- ☐ Add vectorization in onFinish callback
- ☐ Create /api/v1/conversations/search endpoint
- ☐ Build frontend search UI
- ☐ Auto-include relevant conversations in AI context
- ☐ Test semantic search across conversations

**Dependencies:**
- Cloudflare Vectorize (included in Workers)
- OpenAI embeddings API (text-embedding-3-small)
- Additional ~$0.0001 per message for embeddings

**Timeline**: 1-2 days to implement after Steps 1-2 are complete and tested.

---

═══════════════════════════════════════════════
### SUMMARY
═══════════════════════════════════════════════

**After implementation, you'll have:**

✅ **Step 1: Optimized memory injection**
- Only injects on first message
- Saves 50-80% of tokens
- Context available entire conversation

✅ **Step 2: Auto-learning memory system**
- Extracts business facts automatically
- 7 categories including current_projects and challenges
- Updates existing memories (no duplicates)
- Source tracking (auto vs manual)

🔜 **Step 3: Conversation search** (plan provided, implement next)
- Semantic search across all past chats
- "What did we discuss about X?" works
- Full conversation context retrieval

**Implementation time for Steps 1-2**: 45-60 minutes
**Testing time**: 15-20 minutes

---

## 📋 Implementation Timeline

| Step | Time | Output |
|------|------|--------|
| Step 1: Optimize injection | 15 min | First-message-only injection |
| Step 2: Auto-extraction | 45 min | AI learns from conversations |
| Testing | 20 min | E2E flow verified |
| **Total** | **1.5 hours** | ✅ Smart memory system complete |

---

## ✅ Success Checklist

After you finish Steps 1-2, you should be able to:

- ✅ Start new chat, see memory injection log on first message
- ✅ Send second message, see "skipping injection" log
- ✅ Chat about your business for 3+ messages
- ✅ See auto-extraction logs in backend
- ✅ Check database: new memories appear
- ✅ Start new conversation: AI knows your business context
- ✅ Update business info in chat: memory gets updated (not duplicated)
