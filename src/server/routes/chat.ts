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
import { streamText, streamObject, convertToModelMessages, generateText, tool, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { getModel } from '@/lib/ai-providers'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import * as authSchema from '../../../database/better-auth-schema'
import { memories } from '../../../database/schema/memories'
import { agents } from '../../../database/schema/agents'
import { knowledgeBases } from '../../../database/schema/knowledge-base'
import {
  chatRequestSchema,
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

// Artifact schema for streamObject
const artifactSchema = z.object({
  title: z.string().describe('Title of the artifact'),
  kind: z.enum(['text', 'code', 'html', 'react']).describe('Type of artifact'),
  content: z.string().describe('The full content of the artifact'),
  language: z.string().optional().describe('Programming language for code artifacts'),
})

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
    console.log('📥 Received messagesArray:', JSON.stringify(messagesArray, null, 2))

    // Initialize database connection
    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { ...authSchema, memories, agents, knowledgeBases } })

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
      // Check if conversation exists (using SQL builder to ensure proper column name mapping)
      const [existingConv] = await db
        .select()
        .from(authSchema.conversation)
        .where(
          and(
            eq(authSchema.conversation.id, currentConversationId),
            eq(authSchema.conversation.organizationId, organizationId),
            eq(authSchema.conversation.userId, user.id)
          )
        )
        .limit(1)

      // If conversation doesn't exist, create it (frontend generates ID upfront)
      if (!existingConv) {
        console.log('📝 Conversation ID provided but not found, creating new conversation:', currentConversationId)

        // Extract first message for title generation
        let firstMessage = message
        if (!firstMessage && messagesArray && messagesArray.length > 0) {
          const firstMsg = messagesArray[0]
          if (firstMsg.parts && firstMsg.parts.length > 0) {
            firstMessage = firstMsg.parts
              .filter(part => part.type === 'text' && part.text)
              .map(part => part.text)
              .join('')
          } else if (firstMsg.content) {
            firstMessage = firstMsg.content
          }
        }

        if (!firstMessage) {
          firstMessage = 'New Chat'
        }

        // Generate title from first user message
        let title = firstMessage.substring(0, 100)

        if (c.env.OPENAI_API_KEY && firstMessage !== 'New Chat') {
          try {
            const titleModel = getModel({ OPENAI_API_KEY: c.env.OPENAI_API_KEY }, 'gpt-4o-mini')
            const { text: generatedTitle } = await generateText({
              model: titleModel,
              prompt: `Generate a concise, descriptive 3-5 word title for a conversation that starts with: "${firstMessage}"\n\nReturn ONLY the title, no quotes.`,
              maxTokens: 20,
              temperature: 0.7,
            })
            title = generatedTitle.replace(/^["']|["']$/g, '').trim()
          } catch (error) {
            console.error('❌ Title generation failed, using fallback:', error)
          }
        }

        await db.insert(authSchema.conversation).values({
          id: currentConversationId,
          organizationId,
          userId: user.id,
          title,
          toolId: agentId,
          model,
          systemPrompt: null,
          metadata: {},
        })

        console.log('✅ Created conversation from frontend ID:', currentConversationId, 'with title:', title)
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

    // Step 3: Fetch agent instructions if agentId provided
    let agentInstructions = ''
    let artifactInstructions = ''
    let knowledgeBaseContext = ''
    if (agentId) {
      const agent = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, agentId),
            eq(agents.organizationId, organizationId)
          )
        )
        .limit(1)

      if (agent && agent[0]) {
        agentInstructions = agent[0].instructions || ''
        if (agent[0].artifactsEnabled && agent[0].artifactInstructions) {
          artifactInstructions = agent[0].artifactInstructions
        }
        console.log(`🤖 Loaded agent: ${agent[0].name} (artifacts: ${agent[0].artifactsEnabled})`)

        // Check if agent has knowledge base assigned (RAG via AI Search)
        const toolResources = agent[0].toolResources as any
        if (toolResources?.fileSearch?.vectorStoreIds?.[0]) {
          const knowledgeBaseId = toolResources.fileSearch.vectorStoreIds[0]
          console.log(`📚 Agent has knowledge base: ${knowledgeBaseId}`)

          // Get KB metadata for R2 path prefix
          const kb = await db.query.knowledgeBases.findFirst({
            where: eq(knowledgeBases.id, knowledgeBaseId),
          })

          // Retrieve relevant context using Cloudflare AI Search
          if (kb && c.env.AI && userMessageContent) {
            try {
              console.log(`🔍 Searching AI Search: ${kb.aiSearchStoreId}`)
              console.log(`   Query: "${userMessageContent.substring(0, 100)}..."`)
              console.log(`   Filters: orgId=${organizationId}, path=${kb.r2PathPrefix}`)

              // Query AI Search using autorag().aiSearch()
              // Note: AI Search filters by metadata (organizationId, knowledgeBaseId, etc.)
              const result = await c.env.AI.autorag(kb.aiSearchStoreId).aiSearch({
                query: userMessageContent,
                max_num_results: 5,
                rewrite_query: false,
                filters: {
                  // Multi-tenant isolation via metadata filtering
                  organizationId,
                  knowledgeBaseId,
                },
              })

              // Format context from search results
              // AI Search returns: { answer: string, data: Array<{text, metadata, score}> }
              if (result?.data && result.data.length > 0) {
                knowledgeBaseContext = '\n\n═══ KNOWLEDGE BASE CONTEXT ═══\n'
                knowledgeBaseContext += `\nRelevant information from knowledge base "${kb.name}":\n\n`
                result.data.forEach((item: any, index: number) => {
                  knowledgeBaseContext += `[${index + 1}] ${item.text}\n\n`
                })
                knowledgeBaseContext += '═══════════════════════════════\n'
                console.log(`✅ Retrieved ${result.data.length} relevant chunks from AI Search`)
              } else {
                console.log('⚠️ No relevant context found in AI Search')
              }
            } catch (error) {
              console.error('❌ Failed to retrieve KB context from AI Search:', error)
              // Continue without KB context - don't block chat
            }
          } else if (!c.env.AI) {
            console.warn('⚠️ AI binding not available (use wrangler dev --remote for RAG)')
          } else if (!kb) {
            console.warn(`⚠️ Knowledge base ${knowledgeBaseId} not found`)
          }
        }
      }
    }

    // Step 4: Fetch user memories for context injection (ALWAYS - not just first message)
    // IMPORTANT: Always inject memories so AI has access to user context throughout conversation
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
    let memoryContext = ''
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

      console.log(`💭 Injected ${userMemories.length} memories into context`)
    } else {
      console.log('ℹ️  No business memories found for this user')
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
    let messages = convertToModelMessages(uiMessages)

    // Build system prompt with agent instructions, artifact instructions, memory context, and KB context
    let systemPrompt = agentInstructions || 'You are a helpful AI assistant.'

    // Add artifact instructions if enabled
    if (artifactInstructions) {
      systemPrompt += `\n\n${artifactInstructions}`
    }

    // Add knowledge base context (RAG)
    if (knowledgeBaseContext) {
      systemPrompt += `\n\n${knowledgeBaseContext}`
    }

    // Add memory context
    if (memoryContext) {
      systemPrompt += ` You have access to the user's business context which will help you provide more personalized and relevant responses.${memoryContext}`
    }

    // Prepend system message
    messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ]

    console.log('📝 Converted messages:', JSON.stringify(messages, null, 2))

    // Use createUIMessageStream for custom data parts (artifact streaming)
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Track tool calls and results for persistence
        const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []
        const toolResults: Array<{ toolCallId: string; result: unknown }> = []
        const artifactDataMap = new Map<string, { title: string; kind: string; content: string; language?: string }>()

        // Define createDocument tool for artifact generation
        const tools = artifactInstructions ? {
          createDocument: tool({
            description: 'Create a document artifact (code, text, HTML, or React component) for the user to see and interact with',
            inputSchema: z.object({
              title: z.string().describe('Descriptive title for the artifact'),
              kind: z.enum(['text', 'code', 'html', 'react']).describe('Type of artifact to create'),
            }),
            execute: async ({ title, kind }, context?: { toolCallId?: string }) => {
              const toolCallId = context?.toolCallId || nanoid()
              const artifactId = nanoid()
              console.log('🎨 Creating artifact via tool:', { artifactId, toolCallId, title, kind })

              // Track tool call
              toolCalls.push({
                id: toolCallId,
                name: 'createDocument',
                arguments: { title, kind },
              })

              // 1. Signal artifact metadata (opens panel)
              writer.write({
                type: 'data-artifact-metadata',
                id: artifactId,
                data: { id: artifactId, title, kind },
              })

              // 2. Generate artifact content with streamObject
              const { object, fullStream } = streamObject({
                model: aiModel,
                schema: artifactSchema,
                prompt: `Generate a ${kind} artifact with title: "${title}". Provide the full content.`,
              })

              // 3. Stream content deltas to client
              for await (const delta of fullStream) {
                if (delta.type === 'object' && delta.object.content) {
                  writer.write({
                    type: 'data-artifact-delta',
                    id: artifactId,
                    data: delta.object.content,
                  })
                }
              }

              // 4. Wait for final object
              const finalArtifact = await object

              // 5. Signal completion
              writer.write({
                type: 'data-artifact-complete',
                id: artifactId,
                data: finalArtifact,
              })

              // Store artifact data for persistence
              artifactDataMap.set(toolCallId, {
                title: finalArtifact.title,
                kind: finalArtifact.kind,
                content: finalArtifact.content,
                language: finalArtifact.language,
              })

              // Track tool result
              toolResults.push({
                toolCallId,
                result: {
                  artifactId,
                  title: finalArtifact.title,
                  kind: finalArtifact.kind,
                  content: finalArtifact.content,
                  language: finalArtifact.language,
                },
              })

              console.log('✅ Artifact creation complete:', {
                artifactId,
                toolCallId,
                contentLength: finalArtifact.content?.length || 0,
              })

              // Return summary for chat message
              return `Created artifact: ${title}`
            },
          }),
        } : undefined

        // Debug logging
        console.log('🔍 Artifact instructions enabled:', !!artifactInstructions)
        console.log('🔍 Tools defined:', !!tools)
        if (tools) {
          console.log('🔍 Tool names:', Object.keys(tools))
        }

        // Stream AI response with tool support
        const result = streamText({
          model: aiModel,
          messages,
          temperature: 0.7,
          maxTokens: 2048,
          tools,
          onFinish: async ({ text, finishReason, usage, response }) => {
        try {
          console.log('✅ AI response complete:', {
            finishReason,
            usage,
            textLength: text.length,
            toolCallsCount: toolCalls.length,
            toolResultsCount: toolResults.length,
          })

          // 1. Save AI response to database with tool calls and results
          const assistantMessageId = nanoid()
          await db.insert(authSchema.message).values({
            id: assistantMessageId,
            conversationId: currentConversationId!,
            organizationId,
            role: 'assistant',
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            toolResults: toolResults.length > 0 ? toolResults : null,
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

          console.log('💾 Saved assistant message:', assistantMessageId)

          // 2. AUTO-EXTRACT MEMORIES (after 3+ messages)
          const messageCountResult = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(authSchema.message)
            .where(eq(authSchema.message.conversationId, currentConversationId!))

          const messageCount = messageCountResult[0].count

          // Trigger extraction after 3+ messages
          if (messageCount >= 3) {
            console.log('🧠 Starting memory auto-extraction...')

            // Get recent conversation history for context
            const recentMessages = await db
              .select()
              .from(authSchema.message)
              .where(eq(authSchema.message.conversationId, currentConversationId!))
              .orderBy(desc(authSchema.message.createdAt))
              .limit(10) // Last 10 messages for context

            // Build conversation context
            const conversationContext = recentMessages
              .reverse()
              .map(m => `${m.role.toUpperCase()}: ${m.content}`)
              .join('\n\n')

            // Extraction prompt
            const extractionPrompt = `Analyze this conversation and extract any NEW facts about the user that should be remembered long-term.

CONVERSATION HISTORY:
${conversationContext}

EXTRACTION RULES:
1. Only extract factual information explicitly stated by the USER (not AI responses or assumptions)
2. Focus primarily on business context, but may include relevant personal context if naturally mentioned
3. Categories:
   - business_info: Business type, industry, company name, business model
   - target_audience: Who they serve, customer demographics, ideal client profile
   - offers: Products, services, pricing, packages, programs
   - current_projects: What they're actively working on (can be multiple projects)
   - challenges: Pain points, obstacles, problems they face (both immediate and general)
   - goals: Business objectives, targets, aspirations, what they want to achieve
   - personal_info: Family, hobbies, interests, personal preferences (ONLY if naturally mentioned, NOT intrusive)

4. Be specific and concise in values
5. Only extract if explicitly mentioned by user
6. For "personal_info" - ONLY extract if the user volunteers this information naturally (family members, hobbies they mention). DO NOT extract sensitive information or probe for personal details.

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
      "key": "Q2 Initiative",
      "value": "Launching new agent onboarding program"
    },
    {
      "category": "challenges",
      "key": "Lead Generation",
      "value": "Struggling to generate qualified leads for high-ticket coaching"
    },
    {
      "category": "personal_info",
      "key": "Hobby",
      "value": "Enjoys hiking on weekends"
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
                  'goals',
                  'personal_info'
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
      },
        })

        console.log('📡 Stream created, merging into writer')

        // Merge AI stream into writer (includes custom artifact data)
        writer.merge(result.toUIMessageStream())
      },
    })

    // Create response from stream
    const response = createUIMessageStreamResponse({ stream })

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

// /artifact endpoint removed - now using createDocument tool in regular chat

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
