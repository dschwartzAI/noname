/**
 * Agent utility functions for Cloudflare Agents SDK
 *
 * TODO: Implement full tool processing and message cleanup logic
 */

import type { UIMessage } from 'ai'

/**
 * Process pending tool calls (human-in-the-loop confirmations)
 *
 * For now, this is a pass-through - just returns messages as-is
 * TODO: Implement actual tool call confirmation logic
 */
export async function processToolCalls({
  messages,
  dataStream,
  tools,
  executions
}: {
  messages: UIMessage[]
  dataStream?: any
  tools?: any
  executions?: any
}): Promise<UIMessage[]> {
  // For now, just return messages unchanged
  // TODO: Check for pending tool confirmations and process them
  return messages
}

/**
 * Clean up incomplete tool calls to prevent API errors
 *
 * Removes messages with incomplete or malformed tool data
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  // Filter out messages that might cause issues
  return messages.filter(msg => {
    // Keep all non-assistant messages
    if (msg.role !== 'assistant') return true

    // For assistant messages, ensure they have valid content
    if (!msg.parts || msg.parts.length === 0) {
      // Skip empty assistant messages
      return false
    }

    // Keep messages with valid parts
    return true
  })
}
