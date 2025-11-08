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
import { streamText, convertToModelMessages, generateText } from 'ai'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc, asc } from 'drizzle-orm'
import { getModel } from '@/lib/ai-providers'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import * as authSchema from '../../../database/better-auth-schema'
import {
  chatRequestSchema,
  getConversationSchema,
  listConversationsSchema,
  archiveConversationSchema,
  updateConversationSchema,
  conversationIdParamSchema,
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

    console.log('💬 Chat request:', {
      userId: user.id,
      organizationId,
      conversationId,
      hasConversationId: !!conversationId,
      model,
      messageCount: messagesArray?.length,
      hasSingleMessage: !!message
    })

    // Initialize database connection
    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: authSchema })

    // Step 1: Get or create conversation
    let currentConversationId = conversationId
    if (!currentConversationId) {
      // Create new conversation
      currentConversationId = nanoid()

      // Extract first message - handle both AI SDK v5 format and custom API
      let firstMessage = message // Custom API format (single message string)
      if (!firstMessage && messagesArray && messagesArray.length > 0) {
        // AI SDK v5 format - messages have parts array
        const firstMsg = messagesArray[0]
        if (firstMsg.parts && firstMsg.parts.length > 0) {
          // Extract text from parts array
          firstMessage = firstMsg.parts
            .filter(part => part.type === 'text' && part.text)
            .map(part => part.text)
            .join('')
        } else if (firstMsg.content) {
          // Fallback to legacy content field
          firstMessage = firstMsg.content
        }
      }

      if (!firstMessage) {
        firstMessage = 'New Chat'
      }

      // Generate title from first user message (Vercel AI Chatbot pattern)
      let title = firstMessage.substring(0, 100) // Fallback title

      console.log('🔍 Title generation check:', {
        hasOpenAIKey: !!c.env.OPENAI_API_KEY,
        firstMessage,
        firstMessageLength: firstMessage.length,
        isNewChat: firstMessage === 'New Chat'
      })

      if (c.env.OPENAI_API_KEY && firstMessage !== 'New Chat') {
        console.log('🏷️ Generating title with GPT-4o-mini...')
        try {
          const titleModel = getModel({ OPENAI_API_KEY: c.env.OPENAI_API_KEY }, 'gpt-4o-mini')
          const { text: generatedTitle } = await generateText({
            model: titleModel,
            prompt: `Generate a concise, descriptive 3-5 word title for a conversation that starts with: "${firstMessage}"\n\nReturn ONLY the title, no quotes.`,
            maxTokens: 20,
            temperature: 0.7,
          })
          title = generatedTitle.replace(/^["']|["']$/g, '').trim()
          console.log('✅ Generated title:', title)
        } catch (error) {
          console.error('❌ Title generation failed, using fallback:', error)
        }
      } else {
        console.log('⏭️ Skipping title generation - using fallback:', title)
      }

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

      console.log('✅ Created new conversation:', currentConversationId, 'with title:', title)
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

    // Step 2: Save user message (from either format)
    let userMessageId: string | null = null
    let userMessageContent = message // Custom API format

    // If no single message, extract from messages array (AI SDK v5)
    if (!userMessageContent && messagesArray && messagesArray.length > 0) {
      const lastMessage = messagesArray[messagesArray.length - 1]
      if (lastMessage.role === 'user') {
        if (lastMessage.parts && lastMessage.parts.length > 0) {
          userMessageContent = lastMessage.parts
            .filter(part => part.type === 'text' && part.text)
            .map(part => part.text)
            .join('')
        } else if (lastMessage.content) {
          userMessageContent = lastMessage.content
        }
      }
    }

    if (userMessageContent) {
      userMessageId = nanoid()
      await db.insert(authSchema.message).values({
        id: userMessageId,
        conversationId: currentConversationId,
        organizationId,
        role: 'user',
        content: userMessageContent,
        toolCalls: null,
        toolResults: null,
        metadata: null,
      })

      console.log('✅ Saved user message:', userMessageId, 'content length:', userMessageContent.length)
    } else {
      console.log('⚠️ No user message to save')
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
    // IMPORTANT: Pass originalMessages to prevent duplicate messages in client state
    const response = result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
    })

    // Add conversationId to response headers for frontend to track
    response.headers.set('X-Conversation-Id', currentConversationId!)
    // Expose custom header for CORS
    response.headers.set('Access-Control-Expose-Headers', 'X-Conversation-Id')

    return response

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

    const conversations = await db.query.conversation.findMany({
      where: and(...conditions),
      orderBy: [desc(authSchema.conversation.updatedAt)],
      limit,
      offset,
    })

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
        maxTokens: 20,
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
