/**
 * Agent context loading - retrieves agent configuration, memories, and RAG
 *
 * Implements:
 * - Agent configuration loading from database
 * - User memory injection into system prompt
 * - RAG search for knowledge base queries
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, asc, desc } from 'drizzle-orm'
import { agents } from '../../../database/schema/agents'
import { memories } from '../../../database/schema/memories'

interface AgentContext {
  agentName: string
  model: string
  systemPrompt: string
  hasMemories: boolean
  hasKnowledgeBase: boolean
}

/**
 * Load agent context including instructions, memories, and RAG results
 *
 * @param agentId - Agent ID to load
 * @param userId - User ID for memory filtering
 * @param organizationId - Organization ID for multi-tenant isolation
 * @param userQuery - User's latest message for RAG search
 * @param databaseUrl - Neon Postgres connection string
 * @param ai - Cloudflare AI binding (optional, for RAG)
 * @returns Agent context with system prompt and configuration
 */
export async function loadAgentContext(
  agentId: string,
  userId: string,
  organizationId: string,
  userQuery: string,
  databaseUrl: string,
  ai?: any
): Promise<AgentContext> {
  try {
    console.log('📚 Loading agent context:', { agentId, userId, organizationId })

    // Load agent configuration from database
    const sqlClient = neon(databaseUrl)
    const db = drizzle(sqlClient, { schema: { agents, memories } })

    const agent = await db.query.agents.findFirst({
      where: and(
        eq(agents.id, agentId),
        eq(agents.organizationId, organizationId)
      )
    })

    if (!agent) {
      console.warn('⚠️ Agent not found, using defaults')
      return {
        agentName: 'AI Assistant',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a helpful AI assistant.',
        hasMemories: false,
        hasKnowledgeBase: false
      }
    }

    // Build system prompt with agent instructions
    let systemPrompt = agent.instructions || 'You are a helpful AI assistant.'

    // Load user memories and inject into system prompt
    const userMemories = await loadUserMemories(userId, organizationId, databaseUrl)
    const hasMemories = userMemories.length > 0
    
    if (hasMemories) {
      systemPrompt += `

## User Context & Memories
You have access to the following information about this user. Use it to personalize your responses:

${userMemories.join('\n')}

IMPORTANT: When the user asks personal questions (birthday, preferences, business info, etc.), 
check this context first. If the information isn't here, use the queryMemories tool to search for more details.`
    }

    // Append tool usage guidelines
    systemPrompt += `

## Tool Usage Guidelines

**CRITICAL: Only use tools when explicitly needed. For simple conversational responses, DO NOT use any tools.**

### When NOT to use tools:
- Simple acknowledgments like "thanks", "ok", "got it", "sounds good"
- Follow-up questions or clarifications
- Casual conversation or small talk
- Asking for feedback or opinions
- Any response that doesn't require creating content or searching for information

Just respond naturally in the chat without calling any tools.

### queryMemories
Use this tool to search the user's stored memories and personal information.
- Use when asked about personal details (birthday, preferences, goals, etc.)
- Use when asked about business information, strategies, or past decisions
- Use when the user refers to "my" anything (my birthday, my business, my goals)
- The user has stored memories that may contain the answer

### createDocument
Use this tool ONLY when asked to write, create, or generate substantial NEW content.
This tool creates artifacts that open in a side panel for the user to view, edit, and save.

Use createDocument for:
- "Write an essay/article/blog" → createDocument (kind: "document")
- "Help me write..." → createDocument (kind: "document")
- "Create code/script/function" → createDocument (kind: "code")
- "Make an HTML page" → createDocument (kind: "html")
- "Build a React component" → createDocument (kind: "react")

DO NOT use createDocument for:
- Acknowledging that you created something ("thanks", "looks good", etc.)
- Discussing or explaining content you already created
- Simple follow-up messages
- Modifying existing content (unless explicitly asked to regenerate)

### searchKnowledgeBase (if available)
Use this to search the organization's knowledge base for relevant information.
- Use when asked about company policies, documentation, or stored knowledge
- Use for questions that might have answers in uploaded documents`

    // Check if knowledge base is configured (for informational purposes)
    const hasKnowledgeBase = !!(agent as any).knowledgeBaseId

    console.log('✅ Agent context loaded:', {
      name: agent.name,
      model: agent.model,
      promptLength: systemPrompt.length,
      memoriesCount: userMemories.length,
      hasKnowledgeBase
    })

    return {
      agentName: agent.name,
      model: agent.model,
      systemPrompt,
      hasMemories,
      hasKnowledgeBase
    }

  } catch (error) {
    console.error('❌ Failed to load agent context:', error)

    // Return fallback context
    return {
      agentName: 'AI Assistant',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful AI assistant.',
      hasMemories: false,
      hasKnowledgeBase: false
    }
  }
}

/**
 * Load user memories from database
 * Groups memories by category for better context organization
 */
async function loadUserMemories(
  userId: string,
  organizationId: string,
  databaseUrl: string
): Promise<string[]> {
  try {
    const sqlClient = neon(databaseUrl)
    const db = drizzle(sqlClient, { schema: { memories } })

    // Query all user memories
    const userMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, userId),
          eq(memories.organizationId, organizationId)
        )
      )
      .orderBy(asc(memories.category), desc(memories.createdAt))

    if (userMemories.length === 0) {
      return []
    }

    // Group memories by category for better organization
    const groupedMemories: Record<string, { key: string; value: string }[]> = {}
    
    for (const mem of userMemories) {
      if (!groupedMemories[mem.category]) {
        groupedMemories[mem.category] = []
      }
      groupedMemories[mem.category].push({ key: mem.key, value: mem.value })
    }

    // Format as readable sections
    const formattedSections: string[] = []
    
    const categoryLabels: Record<string, string> = {
      'personal_info': '### Personal Information',
      'business_info': '### Business Information',
      'target_audience': '### Target Audience',
      'offers': '### Products & Offers',
      'current_projects': '### Current Projects',
      'challenges': '### Challenges',
      'goals': '### Goals'
    }

    for (const [category, items] of Object.entries(groupedMemories)) {
      const label = categoryLabels[category] || `### ${category}`
      const itemsList = items.map(item => `- **${item.key}**: ${item.value}`).join('\n')
      formattedSections.push(`${label}\n${itemsList}`)
    }

    console.log(`📝 Loaded ${userMemories.length} memories in ${Object.keys(groupedMemories).length} categories`)
    
    return formattedSections

  } catch (error) {
    console.error('❌ Failed to load user memories:', error)
    return []
  }
}

/**
 * Perform RAG search using vector similarity
 * Uses AutoRAG or custom RAG system for semantic search
 */
async function performRAGSearch(
  query: string,
  knowledgeBaseId: string,
  ai?: any
): Promise<string[]> {
  // TODO: Implement when knowledge base feature is enabled
  // This would use the AutoRAGSystem or RAGSystem from lib/
  console.log('📚 RAG search requested but not yet implemented:', { query, knowledgeBaseId })
  return []
}
