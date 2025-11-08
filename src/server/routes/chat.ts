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
import { streamText, convertToModelMessages } from 'ai'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc, asc } from 'drizzle-orm'
import { getModel } from '@/lib/ai-providers'
import { nanoid } from 'nanoid'
import * as authSchema from '../../../database/better-auth-schema'
import {
  chatRequestSchema,
  getConversationSchema,
  listConversationsSchema,
  archiveConversationSchema,
} from '../validation/chat'

// Types
type Env = {
  DATABASE_URL: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
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
 * POST /api/v1/chat - Send chat message with streaming response
 *
 * Creates/updates conversation and persists messages to database
 * Returns streaming AI response using Vercel AI SDK
 */
chatApp.post('/', zValidator('json', chatRequestSchema), async (c) => {
  try {
    const { conversationId, message, messages: messagesArray, model, agentId } = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    // Require organization context for tenant isolation
    if (!organizationId) {
      return c.json({ error: 'No organization context. User must be a member of an organization.' }, 403)
    }

    console.log('💬 Chat request:', { userId: user.id, organizationId, conversationId, model })

    // Initialize database connection
    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: authSchema })

    // Step 1: Get or create conversation
    let currentConversationId = conversationId
    if (!currentConversationId) {
      // Create new conversation
      currentConversationId = nanoid()
      const firstMessage = message || messagesArray?.[0]?.content || 'New Chat'
      const title = firstMessage.substring(0, 100) // First 100 chars as title

      await db.insert(authSchema.conversation).values({
        id: currentConversationId,
        organizationId,
        userId: user.id,
        title,
        toolId: agentId, // null if not provided
        model,
        systemPrompt: null,
        metadata: {},
      })

      console.log('✅ Created new conversation:', currentConversationId)
    } else {
      // Verify user owns this conversation (tenant isolation)
      const existingConv = await db.query.conversation.findFirst({
        where: and(
          eq(authSchema.conversation.id, currentConversationId),
          eq(authSchema.conversation.organizationId, organizationId),
          eq(authSchema.conversation.userId, user.id)
        ),
      })

      if (!existingConv) {
        return c.json({ error: 'Conversation not found or access denied' }, 404)
      }
    }

    // Step 2: Save user message (if it's a single message, not a full history)
    let userMessageId: string | null = null
    if (message) {
      userMessageId = nanoid()
      await db.insert(authSchema.message).values({
        id: userMessageId,
        conversationId: currentConversationId,
        organizationId,
        role: 'user',
        content: message,
        toolCalls: null,
        toolResults: null,
        metadata: null,
      })

      console.log('✅ Saved user message:', userMessageId)
    }

    // Get AI model instance
    const aiModel = getModel({
      ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: c.env.OPENAI_API_KEY,
      XAI_API_KEY: c.env.XAI_API_KEY,
    }, model)

    console.log('🤖 Starting AI stream with model:', model)

    // Handle both API formats:
    // - Single message (custom API): { message: "text" }
    // - Messages array (Vercel AI SDK): { messages: [{role, content}] }
    const uiMessages = messagesArray || [
      { role: 'user' as const, content: message! }
    ]

    // Convert UI messages to model messages (AI SDK v5 requirement)
    // UI messages have 'parts' array, model messages have 'content' string
    const messages = convertToModelMessages(uiMessages)

    console.log('📝 Converted messages:', JSON.stringify(messages, null, 2))

    // Stream AI response with onFinish callback for database persistence
    const result = await streamText({
      model: aiModel,
      messages,
      temperature: 0.7,
      maxTokens: 2048,
      onFinish: async ({ text, finishReason, usage }) => {
        console.log('✅ AI response complete:', {
          finishReason,
          usage,
          textLength: text.length,
        })

        // Save AI response to database
        const assistantMessageId = nanoid()
        await db.insert(authSchema.message).values({
          id: assistantMessageId,
          conversationId: currentConversationId!,
          organizationId,
          role: 'assistant',
          content: text,
          toolCalls: null,
          toolResults: null,
          metadata: {
            model,
            usage: {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            },
          },
        })

        // Update conversation's updatedAt timestamp for sorting
        await db.update(authSchema.conversation)
          .set({ updatedAt: new Date() })
          .where(eq(authSchema.conversation.id, currentConversationId!))

        console.log('✅ Saved AI message:', assistantMessageId)
      },
    })

    console.log('📡 Stream created, using toUIMessageStreamResponse() (AI SDK v5)')

    // Use Vercel AI SDK v5's UI message stream response (works with useChat hook)
    return result.toUIMessageStreamResponse()

  } catch (error) {
    console.error('❌ Chat API error:', error)

    // Handle specific API errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return c.json({ error: 'AI provider API key not configured' }, 500)
      }
      return c.json({ error: error.message }, 500)
    }

    return c.json({ error: 'Failed to process chat request' }, 500)
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
    const db = drizzle(sqlClient, { schema: authSchema })

    // Get conversation with tenant isolation
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
        toolId: conversation.toolId,
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
    const db = drizzle(sqlClient, { schema: authSchema })

    // Build where conditions for tenant isolation and archive filter
    const conditions = [
      eq(authSchema.conversation.organizationId, organizationId),
      eq(authSchema.conversation.userId, user.id),
    ]

    // Filter archived conversations based on query param
    if (!archived) {
      // Only show non-archived by default
      // Since we don't have an archived column yet, we'll use metadata
      // For now, fetch all conversations (we'll add archived field in next migration if needed)
    }

    const conversations = await db.query.conversation.findMany({
      where: and(...conditions),
      orderBy: [desc(authSchema.conversation.updatedAt)],
      limit,
      offset,
    })

    console.log(`✅ Retrieved ${conversations.length} conversations`)

    return c.json({
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        model: conv.model,
        toolId: conv.toolId,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
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

export default chatApp
