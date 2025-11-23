/**
 * Chat API Routes - Production-ready chat with database persistence
 *
 * Handles AI chat conversations with:
 * - Database persistence (conversations + messages)
 * - Streaming responses via Vercel AI SDK
 * - Multi-tenant isolation via organizations
 * - Token usage tracking
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { generateText } from 'ai'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc, asc } from 'drizzle-orm'
import { getModel } from '@/lib/ai-providers'
import { z } from 'zod'
import * as authSchema from '../../../database/better-auth-schema'
import { agents } from '../../../database/schema/agents'
import {
  getConversationSchema,
  listConversationsSchema,
  archiveConversationSchema,
  updateConversationSchema,
  conversationIdParamSchema,
  updateArtifactSchema,
} from '../validation/chat'

// Types
type Env = {
  DATABASE_URL: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
  AI?: any // Cloudflare AI binding (includes AI Search via .autorag())
}

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    isGod: boolean
  }
  organizationId?: string
  organizationRole?: string
}

const chatApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply auth middleware to all routes
chatApp.use('*', requireAuth)
chatApp.use('*', injectOrganization)

/**
 * REMOVED: POST /api/v1/chat endpoint
 *
 * Chat streaming now handled by Agents SDK at /api/agents/chat/*
 * See src/server/agents/chat-agent.ts for implementation
 * Frontend uses useAgentChatSession hook to connect to Agents SDK
 *
 * This file now contains ONLY conversation CRUD operations:
 * - GET / - List conversations
 * - GET /:id - Get conversation history
 * - PATCH /:id - Update conversation metadata
 * - DELETE /:id - Archive conversation
 * - PATCH /artifact - Update artifact content
 * - POST /:id/title - Generate conversation title
 */

/*
// DEPRECATED: Old streaming endpoint removed - Use Agents SDK /api/agents/chat/* instead
*/

/**
 * PATCH /api/v1/chat/artifact - Update artifact content
 *
 * Updates the content of an artifact stored in a message's toolResults
 * NOTE: Must be defined BEFORE /:conversationId route to avoid route conflict
 */
chatApp.patch('/artifact', zValidator('json', updateArtifactSchema), async (c) => {
  try {
    const { conversationId, messageId, toolCallId, content } = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('✏️ Update artifact request:', { 
      conversationId, 
      messageId, 
      toolCallId, 
      contentLength: content.length,
      userId: user.id,
      organizationId,
    })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: authSchema })

    // Verify conversation exists and belongs to user
    const conversation = await db.query.conversation.findFirst({
      where: and(
        eq(authSchema.conversation.id, conversationId),
        eq(authSchema.conversation.organizationId, organizationId),
        eq(authSchema.conversation.userId, user.id)
      ),
    })

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    // Get the message containing the artifact
    const message = await db.query.message.findFirst({
      where: and(
        eq(authSchema.message.id, messageId),
        eq(authSchema.message.conversationId, conversationId),
        eq(authSchema.message.organizationId, organizationId)
      ),
    })

    if (!message) {
      return c.json({ error: 'Message not found' }, 404)
    }

    // Update the artifact content in toolResults
    if (!message.toolResults || message.toolResults.length === 0) {
      console.error('❌ No tool results found in message:', {
        messageId,
        hasToolResults: !!message.toolResults,
        toolResultsLength: message.toolResults?.length,
      })
      return c.json({ error: 'No tool results found in message' }, 400)
    }

    console.log('🔍 Message toolResults:', {
      count: message.toolResults.length,
      toolCallIds: message.toolResults.map(tr => tr.toolCallId),
      requestedToolCallId: toolCallId,
    })

    const updatedToolResults = message.toolResults.map((toolResult) => {
      if (toolResult.toolCallId === toolCallId) {
        console.log('✅ Found matching toolResult, updating content')
        // Update the content in the result object
        const result = toolResult.result as any
        return {
          ...toolResult,
          result: {
            ...result,
            content,
          },
        }
      }
      return toolResult
    })

    // Check if we found the artifact (this should always be true if toolCallId matches)
    const artifactFound = message.toolResults.some(tr => tr.toolCallId === toolCallId)
    if (!artifactFound) {
      console.error('❌ Artifact not found:', {
        toolCallId,
        availableToolCallIds: message.toolResults.map(tr => tr.toolCallId),
        toolResultsCount: message.toolResults.length,
        messageId,
      })
      return c.json({ 
        error: 'Artifact not found in message',
        debug: {
          toolCallId,
          availableToolCallIds: message.toolResults.map(tr => tr.toolCallId),
        }
      }, 404)
    }

    // Update the message with new toolResults
    await db
      .update(authSchema.message)
      .set({ toolResults: updatedToolResults })
      .where(eq(authSchema.message.id, messageId))

    console.log('✅ Artifact updated successfully')

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Update artifact error:', error)
    return c.json({ error: 'Failed to update artifact' }, 500)
  }
})

/**
 * GET /api/v1/chat/:conversationId - Get conversation history
 *
 * Returns all messages in a conversation with pagination
 */
chatApp.get('/:conversationId', zValidator('param', getConversationSchema), async (c) => {
  try {
    const { conversationId } = c.req.valid('param')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('📖 Get conversation:', { conversationId, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { ...authSchema, agents } })

    // Get conversation with tenant isolation and agent info
    const conversation = await db.query.conversation.findFirst({
      where: and(
        eq(authSchema.conversation.id, conversationId),
        eq(authSchema.conversation.organizationId, organizationId),
        eq(authSchema.conversation.userId, user.id)
      ),
      // Include agent relation for UI display
      with: {
        agent: true,
      },
    })

    // Handle case where conversation doesn't exist yet (new chat before first message)
    // Return empty conversation structure instead of 404 to prevent UI errors
    if (!conversation) {
      console.log('⚠️ Conversation not found (new chat?), returning empty state')
      return c.json({
        conversation: {
          id: conversationId,
          title: null,
          model: 'gpt-4o',
          toolId: null,
          agent: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [],
      })
    }

    // Get messages in chronological order
    const messages = await db.query.message.findMany({
      where: and(
        eq(authSchema.message.conversationId, conversationId),
        eq(authSchema.message.organizationId, organizationId)
      ),
      orderBy: [asc(authSchema.message.createdAt)],
      limit: 100, // TODO: Add pagination support
    })

    console.log(`✅ Retrieved ${messages.length} messages`)

    return c.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        toolId: conversation.toolId, // Keep for backward compatibility
        // Include agent info if available
        agent: conversation.agent ? {
          id: conversation.agent.id,
          name: conversation.agent.name,
          description: conversation.agent.description,
          icon: conversation.agent.icon,
          avatar: conversation.agent.avatar,
        } : null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
      })),
    })

  } catch (error) {
    console.error('❌ Get conversation error:', error)
    return c.json({ error: 'Failed to get conversation' }, 500)
  }
})

/**
 * GET /api/v1/chat - List user's conversations
 *
 * Returns paginated list of conversations ordered by last message
 */
chatApp.get('/', zValidator('query', listConversationsSchema), async (c) => {
  try {
    const { limit, offset, archived } = c.req.valid('query')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('📋 List conversations:', { userId: user.id, organizationId, limit, offset, archived })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { ...authSchema, agents } })

    // Build where conditions for tenant isolation and archive filter
    const conditions = [
      eq(authSchema.conversation.organizationId, organizationId),
      eq(authSchema.conversation.userId, user.id),
    ]

    const conversations = await db
      .select({
        id: authSchema.conversation.id,
        title: authSchema.conversation.title,
        model: authSchema.conversation.model,
        toolId: authSchema.conversation.toolId,
        metadata: authSchema.conversation.metadata, // Include metadata for archive filtering
        createdAt: authSchema.conversation.createdAt,
        updatedAt: authSchema.conversation.updatedAt,
        // Join with agents table to get agent info
        agent: {
          id: agents.id,
          name: agents.name,
          icon: agents.icon,
          avatar: agents.avatar,
        },
      })
      .from(authSchema.conversation)
      .leftJoin(agents, eq(authSchema.conversation.toolId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(authSchema.conversation.updatedAt))
      .limit(limit)
      .offset(offset)

    // Filter archived conversations based on query param
    const filteredConversations = archived
      ? conversations
      : conversations.filter(conv => {
          const metadata = conv.metadata as Record<string, unknown> | null
          return !metadata?.archived
        })

    console.log(`✅ Retrieved ${filteredConversations.length} conversations (${conversations.length - filteredConversations.length} archived)`)

    return c.json({
      conversations: filteredConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        model: conv.model,
        toolId: conv.toolId,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        // Include agent info for UI display (null-safe check for left join)
        agent: conv.agent?.id ? {
          id: conv.agent.id,
          name: conv.agent.name!,
          icon: conv.agent.icon,
          avatar: conv.agent.avatar,
        } : null,
      })),
      pagination: {
        limit,
        offset,
        total: conversations.length, // TODO: Get actual count for pagination
      },
    })

  } catch (error) {
    console.error('❌ List conversations error:', error)
    return c.json({ error: 'Failed to list conversations' }, 500)
  }
})

/**
 * PATCH /api/v1/chat/:conversationId - Update conversation (rename, etc.)
 *
 * Updates conversation metadata like title
 */
chatApp.patch('/:conversationId', zValidator('param', conversationIdParamSchema), zValidator('json', updateConversationSchema), async (c) => {
  try {
    const { conversationId } = c.req.valid('param')
    const updates = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('✏️ Update conversation:', { conversationId, userId: user.id, organizationId, updates })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: authSchema })

    // Verify conversation exists and user has access
    const conversation = await db.query.conversation.findFirst({
      where: and(
        eq(authSchema.conversation.id, conversationId),
        eq(authSchema.conversation.organizationId, organizationId),
        eq(authSchema.conversation.userId, user.id)
      ),
    })

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    // Build update object
    const updateData: any = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.systemPrompt !== undefined) updateData.systemPrompt = updates.systemPrompt
    if (updates.model !== undefined) updateData.model = updates.model
    if (updates.parameters !== undefined) {
      updateData.metadata = {
        ...(conversation.metadata as Record<string, unknown> || {}),
        parameters: updates.parameters,
      }
    }

    // Update conversation
    await db.update(authSchema.conversation)
      .set(updateData)
      .where(eq(authSchema.conversation.id, conversationId))

    console.log('✅ Conversation updated')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Update conversation error:', error)
    return c.json({ error: 'Failed to update conversation' }, 500)
  }
})

/**
 * DELETE /api/v1/chat/:conversationId - Archive conversation
 *
 * Soft deletes a conversation (sets archived = true in metadata)
 */
chatApp.delete('/:conversationId', zValidator('param', archiveConversationSchema), async (c) => {
  try {
    const { conversationId } = c.req.valid('param')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('🗑️ Archive conversation:', { conversationId, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: authSchema })

    // Verify conversation exists and user has access
    const conversation = await db.query.conversation.findFirst({
      where: and(
        eq(authSchema.conversation.id, conversationId),
        eq(authSchema.conversation.organizationId, organizationId),
        eq(authSchema.conversation.userId, user.id)
      ),
    })

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    // Mark as archived in metadata
    await db.update(authSchema.conversation)
      .set({
        metadata: {
          ...(conversation.metadata as Record<string, unknown> || {}),
          archived: true,
        },
      })
      .where(eq(authSchema.conversation.id, conversationId))

    console.log('✅ Conversation archived')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Archive conversation error:', error)
    return c.json({ error: 'Failed to archive conversation' }, 500)
  }
})

/**
 * POST /api/v1/chat/:conversationId/title - Generate conversation title
 *
 * Uses GPT-4o-mini to generate a concise title from the first user message
 */
chatApp.post(
  '/:conversationId/title',
  zValidator('param', z.object({ conversationId: z.string().describe('Conversation ID') })),
  async (c) => {
    try {
      const { conversationId } = c.req.valid('param')
      const user = c.get('user')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      console.log('🏷️ Generate title for conversation:', { conversationId, userId: user.id })

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema: authSchema })

      // Verify conversation exists and user has access
      const conversation = await db.query.conversation.findFirst({
        where: and(
          eq(authSchema.conversation.id, conversationId),
          eq(authSchema.conversation.organizationId, organizationId),
          eq(authSchema.conversation.userId, user.id)
        ),
      })

      if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404)
      }

      // Get first user message
      const messages = await db.query.message.findMany({
        where: and(
          eq(authSchema.message.conversationId, conversationId),
          eq(authSchema.message.role, 'user')
        ),
        orderBy: [asc(authSchema.message.createdAt)],
        limit: 1,
      })

      if (messages.length === 0) {
        return c.json({ error: 'No user messages found' }, 400)
      }

      const firstMessage = messages[0].content

      // Generate title using GPT-4o-mini (cheap and fast)
      const aiModel = getModel(
        {
          OPENAI_API_KEY: c.env.OPENAI_API_KEY,
        },
        'gpt-4o-mini'
      )

      const { text: generatedTitle } = await generateText({
        model: aiModel,
        prompt: `Generate a concise, descriptive 3-5 word title for a conversation that starts with this user message. Return ONLY the title, no quotes or extra text:\n\n${firstMessage}`,
        temperature: 0.7,
      })

      // Clean up the title (remove quotes if present)
      const cleanTitle = generatedTitle.replace(/^["']|["']$/g, '').trim()

      // Update conversation title
      await db
        .update(authSchema.conversation)
        .set({ title: cleanTitle })
        .where(eq(authSchema.conversation.id, conversationId))

      console.log('✅ Generated title:', cleanTitle)

      return c.json({ title: cleanTitle })
    } catch (error) {
      console.error('❌ Title generation error:', error)
      return c.json({ error: 'Failed to generate title' }, 500)
    }
  }
)

export default chatApp
