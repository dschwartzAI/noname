/**
 * AI Provider Configuration
 *
 * Configures Anthropic (Claude), OpenAI, and xAI (Grok) providers
 * using the Vercel AI SDK.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

// Anthropic (Claude) Provider
export function getAnthropicProvider(apiKey: string) {
  return createAnthropic({
    apiKey,
  })
}

// OpenAI Provider
export function getOpenAIProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
  })
}

// xAI (Grok) Provider - uses OpenAI-compatible API
export function getXAIProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  })
}

// Available Models
export const MODELS = {
  // Anthropic (Claude)
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',

  // OpenAI
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
  GPT_4_TURBO: 'gpt-4-turbo',
  O1: 'o1',
  O1_MINI: 'o1-mini',

  // xAI (Grok)
  GROK_BETA: 'grok-beta',
  GROK_2_LATEST: 'grok-2-latest',
} as const

// Helper to get a model instance
export function getModel(env: {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
}, modelName: string) {
  // Claude models
  if (modelName.startsWith('claude-')) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }
    const anthropic = getAnthropicProvider(env.ANTHROPIC_API_KEY)
    return anthropic(modelName)
  }

  // Grok models
  if (modelName.startsWith('grok-')) {
    if (!env.XAI_API_KEY) {
      throw new Error('XAI_API_KEY not configured')
    }
    const xai = getXAIProvider(env.XAI_API_KEY)
    return xai(modelName)
  }

  // OpenAI models (default)
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }
  const openai = getOpenAIProvider(env.OPENAI_API_KEY)
  return openai(modelName)
}
