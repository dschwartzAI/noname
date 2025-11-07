/**
 * Chat Validation Schemas
 *
 * Zod schemas for chat API endpoints
 * Descriptions enable oRPC auto-tool generation
 */

import { z } from 'zod'

// Message format from Vercel AI SDK
const aiMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'function', 'data', 'tool']),
  content: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  function_call: z.any().optional(),
  tool_calls: z.any().optional(),
})

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional()
    .describe('Optional conversation ID - creates new conversation if not provided'),

  // Accept EITHER single message (custom API) OR messages array (Vercel AI SDK)
  message: z.string().min(1).max(10000).optional()
    .describe('User message content (1-10000 characters) - for custom API'),

  messages: z.array(aiMessageSchema).optional()
    .describe('Message history array - for Vercel AI SDK format'),

  model: z.string().default('gpt-4o')
    .describe('AI model to use: gpt-4o, gpt-4o-mini, claude-3-5-sonnet, claude-3-5-haiku, grok-beta, grok-2-latest'),

  agentId: z.string().uuid().optional()
    .describe('Optional agent ID for custom agent configuration (system prompt, tools, parameters)'),

  temperature: z.number().min(0).max(2).optional()
    .describe('Temperature for response randomness (0-2, default: 0.7)'),

  maxTokens: z.number().min(1).max(16000).optional()
    .describe('Maximum tokens in response (default: 2048)'),
}).refine(
  (data) => data.message || data.messages,
  { message: 'Either message or messages array is required' }
)

export const getConversationSchema = z.object({
  conversationId: z.string().uuid()
    .describe('Conversation ID to retrieve'),
})

export const listConversationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20)
    .describe('Number of conversations to return (1-100, default: 20)'),

  offset: z.coerce.number().min(0).default(0)
    .describe('Offset for pagination (default: 0)'),

  archived: z.coerce.boolean().default(false)
    .describe('Include archived conversations (default: false)'),
})

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional()
    .describe('Conversation title (1-200 characters)'),

  systemPrompt: z.string().max(5000).optional()
    .describe('Custom system prompt override (max 5000 characters)'),

  model: z.string().optional()
    .describe('Change default model for this conversation'),

  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).max(16000).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
  }).optional()
    .describe('Model parameters for this conversation'),
})

export const archiveConversationSchema = z.object({
  conversationId: z.string().uuid()
    .describe('Conversation ID to archive'),
})

// Alias for param validation
export const conversationIdParamSchema = archiveConversationSchema

export const deleteMessageSchema = z.object({
  messageId: z.string().uuid()
    .describe('Message ID to delete'),
})

export const branchConversationSchema = z.object({
  messageId: z.string().uuid()
    .describe('Message ID to branch from (creates alternate conversation path)'),

  newMessage: z.string().min(1).max(10000)
    .describe('New message content for the branched conversation'),
})

// Type exports for TypeScript
export type ChatRequest = z.infer<typeof chatRequestSchema>
export type GetConversation = z.infer<typeof getConversationSchema>
export type ListConversations = z.infer<typeof listConversationsSchema>
export type UpdateConversation = z.infer<typeof updateConversationSchema>
export type ArchiveConversation = z.infer<typeof archiveConversationSchema>
export type DeleteMessage = z.infer<typeof deleteMessageSchema>
export type BranchConversation = z.infer<typeof branchConversationSchema>
