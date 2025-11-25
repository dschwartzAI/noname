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
 * Also ensures all messages have non-empty content (API requirement)
 * Fixes tool invocations that are missing required fields (args/input)
 * @param modelName - Optional model name to determine provider-specific formatting
 *                    For Claude/Anthropic: sets providerExecuted=true to embed tool_result in assistant message
 *                    For xAI/OpenAI: leaves providerExecuted unset so tool_result goes in separate 'tool' message
 */
export function cleanupMessages(messages: UIMessage[], modelName?: string): UIMessage[] {
  // Determine if we're using Claude/Anthropic (requires tool_result immediately after tool_use)
  const isAnthropicModel = modelName?.startsWith('claude-') ?? false
  console.log('🧹 [cleanupMessages] Starting cleanup with', messages.length, 'messages');
  
  // DETAILED: Log all message parts before cleanup
  // AI SDK uses 'tool-{toolName}' format for tool parts (e.g., 'tool-createDocument')
  messages.forEach((msg, idx) => {
    if (msg.parts && msg.parts.length > 0) {
      const toolParts = msg.parts.filter((p: any) => {
        const partType = p.type as string
        // Check for tool-{toolName} format OR legacy types
        return partType && (
          partType.startsWith('tool-') || 
          partType === 'tool-invocation' || 
          partType === 'tool-call' || 
          partType === 'tool-result'
        )
      });
      if (toolParts.length > 0) {
        console.log(`🔍 [cleanupMessages] Message ${idx} (${msg.role}) has ${toolParts.length} tool parts:`, 
          toolParts.map((p: any) => ({
            type: p.type,
            toolName: p.toolName,
            toolCallId: p.toolCallId?.slice(0, 15),
            hasArgs: p.args !== undefined,
            argsValue: p.args ? JSON.stringify(p.args).slice(0, 100) : null,
            hasInput: p.input !== undefined,
            inputValue: p.input ? JSON.stringify(p.input).slice(0, 100) : null,
            hasOutput: p.output !== undefined,  // CRITICAL: Check for output
            outputValue: p.output ? JSON.stringify(p.output).slice(0, 100) : null,
            state: p.state,
            providerExecuted: p.providerExecuted  // CRITICAL: Check providerExecuted
          }))
        );
      }
    }
  });
  
  // First pass: fix or REMOVE malformed tool parts
  // AI SDK uses 'tool-{toolName}' format for tool parts (e.g., 'tool-createDocument')
  const fixedMessages = messages.map(msg => {
    if (msg.role === 'assistant' && msg.parts && msg.parts.length > 0) {
      // Filter out tool parts that can't be fixed, and fix those that can
      const fixedParts = msg.parts
        .filter((p: any) => {
          const partType = p.type as string
          
          // Check if this is a tool part (type starts with 'tool-')
          const isToolPart = partType && partType.startsWith('tool-')
          
          if (isToolPart) {
            // Check if this tool part is in a valid state
            // It needs input (or args) for the API to accept it
            const hasInput = p.input !== undefined && p.input !== null
            const hasArgs = p.args !== undefined && p.args !== null
            const hasResult = p.result !== undefined || p.output !== undefined
            
            // For incomplete tool calls (streaming state), skip them
            if ((p.state === 'input-streaming' || p.state === 'call') && !hasInput && !hasArgs) {
              console.log('🚫 [cleanupMessages] Removing incomplete tool part (no input):', {
                type: partType,
                toolCallId: p.toolCallId,
                state: p.state
              })
              return false // Remove this tool part
            }
            
            // If it doesn't have a toolCallId, filter it out
            if (!p.toolCallId) {
              console.log('🚫 [cleanupMessages] Removing tool part without toolCallId:', partType)
              return false
            }
            
            return true
          }
          
          // Also handle legacy 'tool-invocation' type for backwards compatibility
          if (p.type === 'tool-invocation') {
            const hasToolName = !!p.toolName
            const hasArgs = p.args !== undefined && p.args !== null
            const hasInput = p.input !== undefined && p.input !== null
            
            if (p.state === 'call' && !hasArgs && !hasInput) {
              console.log('🚫 [cleanupMessages] Removing incomplete tool-invocation (no args):', {
                toolName: p.toolName,
                toolCallId: p.toolCallId,
                state: p.state
              })
              return false
            }
            
            if (!hasToolName) {
              console.log('🚫 [cleanupMessages] Removing tool-invocation without toolName:', p.toolCallId)
              return false
            }
            
            return true
          }
          
          return true // Keep non-tool parts
        })
        .map((p: any) => {
          const partType = p.type as string
          const isToolPart = partType && partType.startsWith('tool-')
          
          if (isToolPart) {
            // Ensure input is never undefined or empty (APIs reject empty tool arguments)
            let fixedInput = p.input ?? p.args ?? {}
            
            // If input is empty but we have output, try to reconstruct input from output
            // This handles cases where tool arguments weren't properly captured during streaming
            const inputIsEmpty = typeof fixedInput === 'object' && Object.keys(fixedInput).length === 0
            if (inputIsEmpty && p.output) {
              // For createDocument, the output contains title, kind, description
              // We can use these as the reconstructed input
              const output = typeof p.output === 'string' ? JSON.parse(p.output) : p.output
              if (output.title || output.kind) {
                fixedInput = {
                  title: output.title || 'Untitled',
                  kind: output.kind || 'document',
                  description: output.description || ''
                }
                console.log('🔄 [cleanupMessages] Reconstructed input from output:', {
                  type: partType,
                  toolCallId: p.toolCallId,
                  reconstructedInput: JSON.stringify(fixedInput).slice(0, 100)
                })
              }
            }
            
            // CRITICAL FIX FOR CLAUDE: Set providerExecuted: true on tool parts with output
            // This causes convertToModelMessages to include tool_result in the assistant message
            // instead of creating a separate 'tool' role message.
            // Claude requires tool_result immediately after tool_use in the SAME message turn.
            // NOTE: Only do this for Anthropic models - xAI/OpenAI expect tool results in separate messages
            const hasOutput = p.output !== undefined || p.state === 'output-available'
            const shouldSetProviderExecuted = isAnthropicModel && hasOutput && p.providerExecuted !== true
            
            console.log('🔧 [cleanupMessages] Fixing tool part:', {
              type: partType,
              toolCallId: p.toolCallId,
              originalHasInput: p.input !== undefined,
              originalHasArgs: p.args !== undefined,
              fixedInput: JSON.stringify(fixedInput).slice(0, 100),
              state: p.state,
              hasOutput,
              isAnthropicModel,
              settingProviderExecuted: shouldSetProviderExecuted
            })
            return {
              ...p,
              input: fixedInput, // AI SDK expects 'input', not 'args'
              toolCallId: p.toolCallId || `tc-${Date.now()}`,
              // Set providerExecuted: true so tool_result is included in assistant message (Claude only)
              ...(shouldSetProviderExecuted && { providerExecuted: true })
            }
          }
          
          // Also handle legacy 'tool-invocation' type
          if (p.type === 'tool-invocation') {
            const fixedArgs = p.args ?? p.input ?? {}
            console.log('🔧 [cleanupMessages] Fixing tool-invocation:', {
              toolName: p.toolName,
              toolCallId: p.toolCallId,
              originalHasArgs: p.args !== undefined,
              originalHasInput: p.input !== undefined,
              fixedArgs: JSON.stringify(fixedArgs).slice(0, 100)
            })
            return {
              ...p,
              args: fixedArgs,
              input: fixedArgs, // Also set input for compatibility
              toolCallId: p.toolCallId || `tc-${Date.now()}`,
              toolName: p.toolName || 'unknown'
            }
          }
          
          return p
        })
      
      console.log('🧹 [cleanupMessages] Message', msg.id?.slice(0, 8), ':', {
        originalParts: msg.parts.length,
        fixedParts: fixedParts.length,
        removedParts: msg.parts.length - fixedParts.length
      });
      
      return { ...msg, parts: fixedParts }
    }
    return msg
  })

  // Second pass: consolidate consecutive assistant messages
  // Claude API requires tool_result immediately after tool_use
  // If we have multiple assistant messages, the tool result won't be in the right position
  const consolidatedMessages: UIMessage[] = []
  for (const msg of fixedMessages) {
    const lastMsg = consolidatedMessages[consolidatedMessages.length - 1]
    
    // If this is an assistant message and the last message was also assistant, merge them
    if (msg.role === 'assistant' && lastMsg?.role === 'assistant') {
      console.log('🔗 [cleanupMessages] Merging consecutive assistant messages:', {
        lastMsgId: lastMsg.id?.slice(0, 8),
        currentMsgId: msg.id?.slice(0, 8),
        lastMsgParts: lastMsg.parts?.length || 0,
        currentMsgParts: msg.parts?.length || 0
      })
      
      // Merge parts from current message into last message
      const mergedParts = [
        ...(lastMsg.parts || []),
        ...(msg.parts || [])
      ]
      
      // Update the last message with merged parts
      consolidatedMessages[consolidatedMessages.length - 1] = {
        ...lastMsg,
        parts: mergedParts
      }
    } else {
      consolidatedMessages.push(msg)
    }
  }
  
  console.log('🔗 [cleanupMessages] After consolidation:', {
    originalCount: fixedMessages.length,
    consolidatedCount: consolidatedMessages.length
  })

  // Third pass: filter out invalid messages
  return consolidatedMessages.filter(msg => {
    // For user messages, ensure they have content
    if (msg.role === 'user') {
      // Check if content exists and is non-empty
      if (typeof msg.content === 'string' && msg.content.trim().length > 0) {
        return true
      }
      // Check parts for text content
      if (msg.parts && msg.parts.length > 0) {
        const hasTextContent = msg.parts.some((p: any) => 
          p.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0
        )
        return hasTextContent
      }
      // Skip empty user messages
      return false
    }

    // For assistant messages, ensure they have valid content
    if (msg.role === 'assistant') {
      // Check if content exists and is non-empty
      if (typeof msg.content === 'string' && msg.content.trim().length > 0) {
        return true
      }
      // Check parts for text content or valid tool invocations
      if (msg.parts && msg.parts.length > 0) {
        const hasValidContent = msg.parts.some((p: any) => {
          // Text parts need non-empty text
          if (p.type === 'text') {
            return typeof p.text === 'string' && p.text.trim().length > 0
          }
          // Tool invocation parts need toolCallId, toolName, and args
          if (p.type === 'tool-invocation') {
            return p.toolCallId && p.toolName && p.args !== undefined
          }
          // Tool result parts are valid
          if (p.type === 'tool-result') {
            return true
          }
          // AI SDK tool parts with 'tool-{toolName}' format (e.g., 'tool-createDocument')
          // These need toolCallId and either input or output
          const partType = p.type as string
          if (partType && partType.startsWith('tool-')) {
            return p.toolCallId && (p.input !== undefined || p.output !== undefined)
          }
          return false
        })
        return hasValidContent
      }
      // Skip empty assistant messages
      return false
    }

    // Keep system messages
    return true
  })
}
