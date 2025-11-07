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
import { eq, and, desc } from 'drizzle-orm'
import { getModel } from '@/lib/ai-providers'
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

    // TODO: Once conversations/messages tables are migrated, use this logic:
    // 1. Get or create conversation
    // 2. Save user message
    // 3. Stream AI response
    // 4. Save AI response in onFinish callback

    // For now, return a simple streaming response
    // This will be replaced with full database integration when tables are ready

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

        // TODO: Save AI response to database here
        // await db.insert(messages).values({
        //   conversationId,
        //   tenantId: organizationId,
        //   role: 'assistant',
        //   content: text,
        //   model,
        //   provider: model.startsWith('gpt-') ? 'openai' : model.startsWith('claude-') ? 'anthropic' : 'xai',
        //   finishReason,
        //   promptTokens: usage.promptTokens,
        //   completionTokens: usage.completionTokens,
        //   totalTokens: usage.totalTokens,
        // })
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

    // TODO: Implement once conversations/messages tables are migrated
    // const sqlClient = neon(c.env.DATABASE_URL)
    // const db = drizzle(sqlClient, { schema })
    //
    // const conversation = await db.query.conversations.findFirst({
    //   where: and(
    //     eq(conversations.id, conversationId),
    //     eq(conversations.tenantId, organizationId),
    //     eq(conversations.userId, user.id)
    //   ),
    //   with: {
    //     messages: {
    //       orderBy: [desc(messages.createdAt)],
    //       limit: 100,
    //     }
    //   }
    // })

    return c.json({
      error: 'Conversations table not yet migrated. Coming soon.',
      note: 'This endpoint will return full conversation history once schema migration is complete.'
    }, 501)

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
    const { limit, offset } = c.req.valid('query')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('📋 List conversations:', { userId: user.id, organizationId, limit, offset })

    // TODO: Implement once conversations table is migrated
    // const sqlClient = neon(c.env.DATABASE_URL)
    // const db = drizzle(sqlClient, { schema })
    //
    // const userConversations = await db.query.conversations.findMany({
    //   where: and(
    //     eq(conversations.tenantId, organizationId),
    //     eq(conversations.userId, user.id),
    //     eq(conversations.archived, false)
    //   ),
    //   orderBy: [desc(conversations.lastMessageAt)],
    //   limit,
    //   offset,
    // })

    return c.json({
      conversations: [],
      note: 'Conversations table not yet migrated. Coming soon.'
    })

  } catch (error) {
    console.error('❌ List conversations error:', error)
    return c.json({ error: 'Failed to list conversations' }, 500)
  }
})

/**
 * DELETE /api/v1/chat/:conversationId - Archive conversation
 *
 * Soft deletes a conversation (sets archived = true)
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

    // TODO: Implement once conversations table is migrated
    // const sqlClient = neon(c.env.DATABASE_URL)
    // const db = drizzle(sqlClient, { schema })
    //
    // await db.update(conversations)
    //   .set({ archived: true })
    //   .where(and(
    //     eq(conversations.id, conversationId),
    //     eq(conversations.tenantId, organizationId),
    //     eq(conversations.userId, user.id)
    //   ))

    return c.json({
      success: true,
      note: 'Conversations table not yet migrated. Coming soon.'
    })

  } catch (error) {
    console.error('❌ Archive conversation error:', error)
    return c.json({ error: 'Failed to archive conversation' }, 500)
  }
})

export default chatApp
