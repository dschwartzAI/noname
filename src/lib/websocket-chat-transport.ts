/**
 * Custom WebSocket Chat Transport for AI SDK
 * 
 * Implements the ChatTransport interface to enable WebSocket-based
 * communication with Cloudflare Agents SDK backend.
 * 
 * This transport:
 * - Opens WebSocket connections to the Chat Agent Durable Object
 * - Sends messages via WebSocket instead of HTTP POST
 * - Parses the UI Message Stream protocol from the backend
 * - Supports dynamic agent configuration (agentId, model, etc.)
 * 
 * Protocol Flow:
 * 1. Client connects via WebSocket to /api/agents/chat/websocket
 * 2. Client sends message in Agents SDK format (cf-agent-use-chat-append)
 * 3. Backend responds with Vercel Data Stream Protocol (0:"text", d:{finish}, etc.)
 * 4. This transport parses the stream and emits UIMessageChunk events
 */

import type { UIMessage } from 'ai'

/**
 * UIMessageChunk types from AI SDK
 * The stream emits chunks like: text-start, text-delta, tool-input-start, etc.
 */
// UIMessageChunk type based on AI SDK v5 actual types
// See node_modules/ai/dist/index.d.ts for reference
type UIMessageChunk = 
  | { type: 'start'; messageId?: string }
  | { type: 'start-step' }
  | { type: 'finish-step' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }  // AI SDK uses 'delta', not 'textDelta'
  | { type: 'text-end'; id: string }
  | { type: 'tool-input-start'; toolName: string; toolCallId: string }
  | { type: 'tool-input-delta'; toolCallId: string; inputDelta: string }
  | { type: 'tool-input-available'; toolCallId: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'finish'; finishReason?: string }
  | { type: 'abort' }
  | { type: 'error'; errorText: string }
  // Artifact events (custom data parts - handled via callbacks, not enqueued to SDK)
  | { type: 'artifact-start'; artifactId: string; title: string; kind: string }
  | { type: 'artifact-delta'; artifactId: string; delta: string }
  | { type: 'artifact-complete'; artifactId: string; title: string; kind: string; content: string }
  | { type: 'artifact-error'; artifactId: string; error: string }

/**
 * Configuration options for WebSocketChatTransport
 */
export interface WebSocketChatTransportOptions {
  /**
   * Base URL for WebSocket connection
   * Defaults to window.location.origin with ws/wss protocol
   */
  baseUrl?: string

  /**
   * Agent ID to use for this chat session
   */
  agentId: string

  /**
   * User ID for multi-tenant isolation
   */
  userId: string

  /**
   * Organization ID for multi-tenant isolation
   */
  organizationId: string

  /**
   * Optional model override (defaults to agent's configured model)
   */
  model?: string

  /**
   * Called when WebSocket connection opens
   */
  onOpen?: () => void

  /**
   * Called when WebSocket connection closes
   */
  onClose?: () => void

  /**
   * Called on WebSocket error
   */
  onError?: (error: Event) => void
  
  /**
   * Called when connecting (before open)
   */
  onConnecting?: () => void
  
  /**
   * Called when artifact generation starts
   */
  onArtifactStart?: (data: { artifactId: string; title: string; kind: string }) => void
  
  /**
   * Called with artifact content deltas
   */
  onArtifactDelta?: (data: { artifactId: string; delta: string }) => void
  
  /**
   * Called when artifact generation completes
   */
  onArtifactComplete?: (data: { artifactId: string; title: string; kind: string; content: string }) => void
}

/**
 * ChatTransport interface from AI SDK
 * We implement this to provide custom WebSocket communication
 */
interface ChatTransport<UI_MESSAGE extends UIMessage> {
  sendMessages: (options: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UI_MESSAGE[]
    abortSignal: AbortSignal | undefined
    headers?: Record<string, string>
    body?: Record<string, unknown>
    metadata?: unknown
  }) => Promise<ReadableStream<UIMessageChunk>>

  reconnectToStream: (options: {
    chatId: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
    metadata?: unknown
  }) => Promise<ReadableStream<UIMessageChunk> | null>
}

/**
 * Parse Vercel AI SDK Data Stream Protocol
 * 
 * The backend (chat-agent.ts) uses createUIMessageStreamResponse() which sends:
 * - `0:"text content"` - text delta
 * - `a:{"toolCallId":"...","toolName":"..."}` - tool call start  
 * - `b:{"toolCallId":"...","argsTextDelta":"..."}` - tool call args delta
 * - `c:{"toolCallId":"...","args":{...}}` - tool call args complete
 * - `9:{"toolCallId":"...","result":...}` - tool result
 * - `d:{"finishReason":"stop"}` - finish
 * - `e:{"error":"..."}` - error
 * - `8:{"messageId":"..."}` - message start
 * 
 * See: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
 */
function parseStreamLine(line: string): UIMessageChunk | null {
  if (!line || line.trim() === '') return null
  
  // Format: TYPE_CODE:JSON_DATA
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) return null
  
  const typeCode = line.substring(0, colonIndex)
  const dataStr = line.substring(colonIndex + 1)
  
  try {
    switch (typeCode) {
      case '0': {
        // Text delta - data is a JSON-encoded string
        const text = JSON.parse(dataStr)
        return { type: 'text-delta', id: '', delta: text }
      }
      
      case 'a': {
        // Tool call start
        const data = JSON.parse(dataStr)
        return { 
          type: 'tool-input-start', 
          toolName: data.toolName,
          toolCallId: data.toolCallId 
        }
      }
      
      case 'b': {
        // Tool call input delta (args streaming)
        const data = JSON.parse(dataStr)
        return { 
          type: 'tool-input-delta', 
          inputDelta: data.argsTextDelta || data.delta || '' 
        }
      }
      
      case 'c': {
        // Tool call input available (full args parsed)
        const data = JSON.parse(dataStr)
        return { type: 'tool-input-available', toolCallId: data.toolCallId || '', input: data.args || data }
      }
      
      case '9': {
        // Tool result
        const data = JSON.parse(dataStr)
        return { type: 'tool-output-available', output: data.result }
      }
      
      case 'd': {
        // Finish message
        const data = JSON.parse(dataStr)
        return { type: 'finish', finishReason: data.finishReason || 'stop' }
      }
      
      case 'e': {
        // Error
        const data = JSON.parse(dataStr)
        return { type: 'error', error: data.error || data.message || 'Unknown error' }
      }
      
      case 'f': {
        // Message annotations / metadata - skip for now
        return null
      }
      
      case '2': {
        // Data part (custom data like artifacts)
        const data = JSON.parse(dataStr)
        return { type: 'data-part-available', data }
      }
      
      case '8': {
        // Message start with ID
        const data = JSON.parse(dataStr)
        return { type: 'message-start', messageId: data.messageId || data.id }
      }
      
      default:
        // Unknown type code - log for debugging
        console.debug('[WS Transport] Unknown stream type:', typeCode, dataStr.substring(0, 100))
        return null
    }
  } catch (err) {
    console.error('[WS Transport] Parse error for line:', line.substring(0, 100), err)
    return null
  }
}

/**
 * WebSocket-based Chat Transport
 * 
 * Connects to Cloudflare Agent Durable Object via WebSocket
 * and streams responses using the AI SDK UI Message protocol.
 */
export class WebSocketChatTransport<UI_MESSAGE extends UIMessage = UIMessage> 
  implements ChatTransport<UI_MESSAGE> {
  
  private options: WebSocketChatTransportOptions
  private ws: WebSocket | null = null
  private connectionPromise: Promise<void> | null = null
  
  constructor(options: WebSocketChatTransportOptions) {
    this.options = options
  }
  
  /**
   * Get WebSocket URL for the Chat Agent
   */
  private getWebSocketUrl(chatId: string): string {
    const baseUrl = this.options.baseUrl || window.location.origin
    // Backend route pattern: /agents/chat/:conversationId (proxied by Vite)
    const wsUrl = new URL(`/agents/chat/${chatId}`, baseUrl)
    
    // Convert to ws/wss protocol
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    
    // Pass context via query params (Agent reads these on connection)
    wsUrl.searchParams.set('agentId', this.options.agentId)
    wsUrl.searchParams.set('userId', this.options.userId)
    wsUrl.searchParams.set('organizationId', this.options.organizationId)
    
    if (this.options.model) {
      wsUrl.searchParams.set('model', this.options.model)
    }
    
    return wsUrl.toString()
  }
  
  /**
   * Ensure WebSocket is connected
   */
  private async ensureConnection(chatId: string): Promise<WebSocket> {
    // If already connected and open, reuse
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws
    }
    
    // If connecting, wait for it
    if (this.connectionPromise) {
      await this.connectionPromise
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return this.ws
      }
    }
    
    // Create new connection
    this.connectionPromise = new Promise((resolve, reject) => {
      const url = this.getWebSocketUrl(chatId)
      console.log('[WS Transport] Connecting to:', url)
      
      const ws = new WebSocket(url)
      
      ws.onopen = () => {
        console.log('[WS Transport] Connected')
        this.ws = ws
        this.options.onOpen?.()
        resolve()
      }
      
      ws.onerror = (event) => {
        console.error('[WS Transport] Connection error:', event)
        this.options.onError?.(event)
        reject(new Error('WebSocket connection failed'))
      }
      
      ws.onclose = () => {
        console.log('[WS Transport] Disconnected')
        this.ws = null
        this.connectionPromise = null
        this.options.onClose?.()
      }
    })
    
    await this.connectionPromise
    return this.ws!
  }
  
  /**
   * Send messages and return a stream of UI message chunks
   */
  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UI_MESSAGE[]
    abortSignal: AbortSignal | undefined
    headers?: Record<string, string>
    body?: Record<string, unknown>
    metadata?: unknown
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { chatId, messages, abortSignal, body, metadata } = options
    
    // Connect to WebSocket
    const ws = await this.ensureConnection(chatId)
    
    // Create a readable stream that will receive chunks from WebSocket
    let streamController: ReadableStreamDefaultController<UIMessageChunk>
    let streamClosed = false
    
    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        streamController = controller
      },
      cancel() {
        streamClosed = true
        console.log('[WS Transport] Stream cancelled by consumer')
      }
    })
    
    // Buffer for incomplete lines (stream data can split across WS messages)
    let buffer = ''
    let textStarted = false
    // Track the current text part ID for proper chunk correlation
    // The backend sends an 'id' field with text-start/text-delta/text-end events
    let currentTextId = ''
    
    // Handle incoming WebSocket messages
    const messageHandler = (event: MessageEvent) => {
      if (streamClosed) return
      
      const data = event.data as string
      
      // Check if this is a JSON message (Agents SDK internal messages)
      // vs Data Stream Protocol (lines like "0:\"text\"")
      if (data.startsWith('{')) {
        try {
          const jsonMsg = JSON.parse(data)
          // Handle Agents SDK internal messages (note: underscores in type names)
          if (jsonMsg.type === 'cf_agent_chat_messages') {
            // Full message sync - can be used for history
            console.log('[WS Transport] Received message sync:', jsonMsg.messages?.length)
            return
          }
          if (jsonMsg.type === 'cf_agent_use_chat_response') {
            // This is the main response format from AIChatAgent
            // body is a JSON string containing: { type: 'text-delta' | 'text-start' | 'text-end', delta?: string, ... }
            // done indicates if streaming is complete
            console.log('[WS Transport] Received chat response:', { done: jsonMsg.done, hasBody: !!jsonMsg.body })
            
            if (jsonMsg.body) {
              try {
                const bodyData = JSON.parse(jsonMsg.body)
                console.log('[WS Transport] Body data:', bodyData.type)
                
                // Convert SDK format to UIMessageChunk format
                // IMPORTANT: The AI SDK requires 'id' on text-start, text-delta, text-end chunks
                // to properly correlate them and update the message state
                switch (bodyData.type) {
                  case 'start':
                    // Message start - emit message-start with the message ID
                    streamController.enqueue({ 
                      type: 'message-start', 
                      messageId: bodyData.messageId || bodyData.id || crypto.randomUUID() 
                    })
                    break
                  case 'start-step':
                    // Step start - emit start-step for multi-step rendering
                    // Also reset text state for the new step
                    textStarted = false
                    currentTextId = ''
                    streamController.enqueue({ type: 'start-step' })
                    break
                  case 'text-start':
                    // Text block start - include the ID for proper correlation
                    currentTextId = bodyData.id || crypto.randomUUID()
                    console.log('[WS Transport] text-start: textStarted was', textStarted, 'setting to true')
                    if (!textStarted) {
                      textStarted = true
                      console.log('[WS Transport] Enqueuing text-start with id:', currentTextId)
                      streamController.enqueue({ type: 'text-start', id: currentTextId })
                    }
                    break
                  case 'text-delta':
                    // Text delta - MUST include the same ID as text-start
                    const textId = bodyData.id || currentTextId || crypto.randomUUID()
                    if (!textStarted) {
                      textStarted = true
                      currentTextId = textId
                      console.log('[WS Transport] text-delta: creating text-start first with id:', textId)
                      streamController.enqueue({ type: 'text-start', id: textId })
                    }
                    // DEBUG: Log the full bodyData to see what fields are present
                    console.log('[WS Transport] text-delta bodyData:', JSON.stringify(bodyData))
                    // The delta can be in 'delta' or 'textDelta' field from backend
                    // UIMessageChunk expects 'delta' property (AI SDK v5)
                    const deltaText = bodyData.delta || bodyData.textDelta || ''
                    console.log('[WS Transport] deltaText extracted:', deltaText ? deltaText.substring(0, 50) : '(empty)')
                    if (deltaText) {
                      streamController.enqueue({ type: 'text-delta', id: textId, delta: deltaText })
                    }
                    break
                  case 'text-end':
                    // Text block end - include the ID
                    // Only emit if we haven't already ended the text
                    if (textStarted) {
                      streamController.enqueue({ type: 'text-end', id: bodyData.id || currentTextId })
                      textStarted = false // Mark text as ended so we don't emit text-end again
                    }
                    break
                  case 'finish-step':
                    // Step finished - emit finish-step
                    streamController.enqueue({ type: 'finish-step' })
                    break
                  case 'finish':
                    // Stream finished - close text if needed and emit finish
                    // Only emit text-end if we haven't already (textStarted is true)
                    if (textStarted) {
                      streamController.enqueue({ type: 'text-end', id: currentTextId })
                      textStarted = false
                    }
                    streamController.enqueue({ 
                      type: 'finish',
                      finishReason: bodyData.finishReason || 'stop'
                    })
                    // Don't close here - wait for done: true
                    break
                  case 'tool-call-start':
                    streamController.enqueue({
                      type: 'tool-input-start',
                      toolName: bodyData.toolName,
                      toolCallId: bodyData.toolCallId
                    })
                    break
                  case 'tool-call-delta':
                    streamController.enqueue({
                      type: 'tool-input-delta',
                      toolCallId: bodyData.toolCallId,
                      inputTextDelta: bodyData.argsTextDelta || ''  // AI SDK expects 'inputTextDelta'
                    })
                    break
                  case 'tool-call':
                    // Emit tool-input-start and tool-input-available for the SDK
                    console.log('[WS Transport] Tool call:', bodyData.toolName, bodyData.toolCallId, 'args:', JSON.stringify(bodyData.args)?.slice(0, 100))
                    streamController.enqueue({
                      type: 'tool-input-start',
                      toolName: bodyData.toolName,
                      toolCallId: bodyData.toolCallId
                    })
                    // CRITICAL: tool-input-available MUST include toolName!
                    // Without it, the AI SDK won't properly populate the input field
                    streamController.enqueue({
                      type: 'tool-input-available',
                      toolCallId: bodyData.toolCallId,
                      toolName: bodyData.toolName,  // REQUIRED by AI SDK
                      input: bodyData.args || {}    // Ensure input is always present
                    })
                    break
                  case 'tool-result':
                    // Emit tool-output-available for the SDK
                    console.log('[WS Transport] Tool result:', bodyData.toolCallId, bodyData.result ? 'has result' : 'no result')
                    streamController.enqueue({
                      type: 'tool-output-available',
                      toolCallId: bodyData.toolCallId,
                      output: bodyData.result
                    })
                    // Reset text state after tool result so next text block starts fresh
                    textStarted = false
                    currentTextId = ''
                    break
                  case 'error':
                    // Log the full error data to understand the structure
                    console.error('[WS Transport] Backend error:', bodyData)
                    const errorMessage = bodyData.error || bodyData.message || bodyData.errorText || 'Unknown backend error'
                    streamController.enqueue({
                      type: 'error',
                      errorText: errorMessage
                    })
                    // Close the stream after error
                    if (!streamClosed) {
                      streamClosed = true
                      streamController.close()
                      ws.removeEventListener('message', messageHandler)
                    }
                    break
                  
                  // Handle data events (artifacts, custom data)
                  case 'data':
                    // Data events contain an array of data items
                    const dataItems = Array.isArray(bodyData.data) ? bodyData.data : [bodyData.data]
                    for (const item of dataItems) {
                      if (!item || !item.type) continue
                      
                      switch (item.type) {
                        case 'artifact-start':
                          console.log('🎨 [WS Transport] Artifact start:', item.title)
                          // Call callback (for UI to open panel)
                          this.options.onArtifactStart?.({
                            artifactId: item.artifactId,
                            title: item.title,
                            kind: item.kind,
                          })
                          break
                        case 'artifact-delta':
                          // Call callback (for UI to update content)
                          // Log full item to see all properties
                          console.log('🎨 [WS Transport] Artifact delta FULL:', {
                            itemKeys: Object.keys(item),
                            artifactId: item.artifactId,
                            delta: item.delta,
                            textDelta: (item as any).textDelta,
                          })
                          // Use delta or textDelta (backend might send either)
                          const deltaText = item.delta || (item as any).textDelta
                          this.options.onArtifactDelta?.({
                            artifactId: item.artifactId,
                            delta: deltaText,
                          })
                          break
                        case 'artifact-complete':
                          console.log('✅ [WS Transport] Artifact complete:', item.title)
                          // Call callback (for UI to finalize)
                          this.options.onArtifactComplete?.({
                            artifactId: item.artifactId,
                            title: item.title,
                            kind: item.kind,
                            content: item.content,
                          })
                          break
                        case 'artifact-error':
                          console.error('❌ [WS Transport] Artifact error:', item.error)
                          break
                        default:
                          console.debug('[WS Transport] Unknown data item type:', item.type)
                      }
                    }
                    break
                    
                  default:
                    console.debug('[WS Transport] Unknown body type:', bodyData.type, bodyData)
                }
              } catch (e) {
                // Body might be plain text
                console.debug('[WS Transport] Body is not JSON, treating as text:', jsonMsg.body.substring(0, 50))
                if (!textStarted) {
                  textStarted = true
                  currentTextId = crypto.randomUUID()
                  streamController.enqueue({ type: 'text-start', id: currentTextId })
                }
                streamController.enqueue({ type: 'text-delta', id: currentTextId, delta: jsonMsg.body })
              }
            }
            
            // Check if streaming is done
            if (jsonMsg.done) {
              console.log('[WS Transport] Stream complete (done=true)')
              if (!streamClosed) {
                // Only emit finish if we haven't already
                if (textStarted) {
                  streamController.enqueue({ type: 'text-end', id: currentTextId })
                }
                streamController.enqueue({ type: 'finish', finishReason: 'stop' })
                streamClosed = true
                streamController.close()
              }
              ws.removeEventListener('message', messageHandler)
            }
            return
          }
          if (jsonMsg.type === 'cf_agent_mcp_servers') {
            // MCP server list - can ignore for chat
            console.debug('[WS Transport] MCP servers available:', jsonMsg.servers?.length || 0)
            return
          }
          if (jsonMsg.type === 'cf_agent_state') {
            // Agent state update - can ignore for chat
            console.debug('[WS Transport] Agent state update')
            return
          }
          // Unknown JSON message - log and continue
          console.debug('[WS Transport] Unknown JSON message type:', jsonMsg.type)
          return
        } catch {
          // Not valid JSON, treat as stream data
        }
      }
      
      // Process Data Stream Protocol lines
      buffer += data
      
      // Split by newlines and process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        const chunk = parseStreamLine(line)
        if (!chunk) continue
        
        // Emit text-start before first text-delta
        if (chunk.type === 'text-delta' && !textStarted) {
          textStarted = true
          const textId = (chunk as any).id || crypto.randomUUID()
          streamController.enqueue({ type: 'text-start', id: textId })
        }
        
        streamController.enqueue(chunk)
        
        // Close stream on finish or error
        if (chunk.type === 'finish' || chunk.type === 'error') {
          // Process any remaining buffer
          if (buffer.trim()) {
            const finalChunk = parseStreamLine(buffer)
            if (finalChunk) {
              streamController.enqueue(finalChunk)
            }
          }
          if (textStarted) {
            streamController.enqueue({ type: 'text-end', id: currentTextId || '' })
          }
          streamClosed = true
          streamController.close()
          ws.removeEventListener('message', messageHandler)
          return
        }
      }
    }
    
    ws.addEventListener('message', messageHandler)
    
    // Handle abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        if (!streamClosed) {
          streamClosed = true
          ws.removeEventListener('message', messageHandler)
          streamController.close()
        }
      })
    }
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    
    // Extract text content from message parts
    const textContent = lastMessage?.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('\n') || ''
    
    // Build message ID
    const messageId = lastMessage?.id || crypto.randomUUID()
    
    // Send message in Cloudflare Agents SDK format
    // The SDK expects: { type: 'cf_agent_use_chat_request', init: { method: 'POST', body: '{"messages": [...]}' } }
    // Note: underscores in type, not dashes!
    const messagePayload = {
      messages: [
        ...options.messages.slice(0, -1).map(m => {
          // Ensure parts are properly formatted with text content
          // IMPORTANT: Also fix tool-invocation parts to ensure they have valid args
          // Streaming can leave tool invocations in incomplete states
          let parts = m.parts
          if (!parts || parts.length === 0) {
            parts = [{ type: 'text', text: typeof m.content === 'string' ? m.content : '' }]
          } else {
            // Filter and ensure all parts are properly formatted
            parts = parts
              .filter(p => {
                const partType = (p as any).type
                
                // AI SDK uses 'tool-{toolName}' format for tool parts (e.g., 'tool-createDocument')
                // Check if this is a tool part by checking if type starts with 'tool-'
                const isToolPart = partType && partType.startsWith('tool-')
                
                if (isToolPart) {
                  const toolPart = p as any
                  const hasInput = toolPart.input !== undefined && toolPart.input !== null
                  const hasArgs = toolPart.args !== undefined && toolPart.args !== null
                  
                  // If it's in 'input-streaming' or 'input-available' state without input, filter it out
                  // These are incomplete tool calls that will cause API errors
                  if ((toolPart.state === 'input-streaming' || toolPart.state === 'call') && !hasInput && !hasArgs) {
                    console.log('[WS Transport] Filtering incomplete tool part:', {
                      type: partType,
                      toolCallId: toolPart.toolCallId,
                      state: toolPart.state
                    })
                    return false
                  }
                  
                  // If it doesn't have a toolCallId, filter it out
                  if (!toolPart.toolCallId) {
                    console.log('[WS Transport] Filtering tool part without toolCallId')
                    return false
                  }
                }
                return true
              })
              .map(p => {
                if ((p as any).type === 'text') {
                  return { type: 'text', text: (p as any).text || '' }
                }
                
                const partType = (p as any).type
                const isToolPart = partType && partType.startsWith('tool-')
                
                // For tool parts, ensure input is always present (AI SDK expects 'input', not 'args')
                if (isToolPart) {
                  const toolPart = p as any
                  const fixedInput = toolPart.input ?? toolPart.args ?? {}
                  console.log('[WS Transport] Sending tool part:', {
                    type: partType,
                    toolCallId: toolPart.toolCallId,
                    hasInput: toolPart.input !== undefined,
                    hasArgs: toolPart.args !== undefined,
                    fixedInputKeys: Object.keys(fixedInput),
                    state: toolPart.state
                  })
                  return {
                    ...toolPart,
                    input: fixedInput // AI SDK expects 'input', not 'args'
                  }
                }
                return p
              })
          }
          return {
            id: m.id,
            role: m.role,
            parts,
            metadata: {
              createdAt: new Date().toISOString(),
              userId: this.options.userId,
              organizationId: this.options.organizationId,
              agentId: this.options.agentId,
              conversationId: chatId,
              model: this.options.model
            }
          }
        }),
        {
          id: messageId,
          role: 'user',
          parts: [{ type: 'text', text: textContent }],
          metadata: {
            createdAt: new Date().toISOString(),
            userId: this.options.userId,
            organizationId: this.options.organizationId,
            agentId: this.options.agentId,
            conversationId: chatId,
            model: this.options.model,
            ...((metadata as object) || {}),
            ...(body || {})
          }
        }
      ]
    }
    
    const payload = {
      type: 'cf_agent_use_chat_request',
      init: {
        method: 'POST',
        body: JSON.stringify(messagePayload)
      }
    }
    
    const sendTime = performance.now()
    console.log('[WS Transport] Sending:', { 
      chatId, 
      text: textContent.substring(0, 50),
      agentId: this.options.agentId,
      timestamp: sendTime
    })
    ws.send(JSON.stringify(payload))
    
    // Track first token timing
    let firstTokenLogged = false
    const originalEnqueue = streamController.enqueue.bind(streamController)
    streamController.enqueue = (chunk: UIMessageChunk) => {
      if (!firstTokenLogged && (chunk.type === 'text-delta' || chunk.type === 'text-start')) {
        const latency = performance.now() - sendTime
        console.log(`⚡ [WS Transport] First token latency: ${latency.toFixed(0)}ms`)
        firstTokenLogged = true
      }
      originalEnqueue(chunk)
    }
    
    // Emit message-start immediately (backend will also send one)
    streamController.enqueue({ type: 'message-start', messageId: crypto.randomUUID() })
    
    return stream
  }
  
  /**
   * Reconnect to an existing stream (for resuming interrupted connections)
   */
  async reconnectToStream(options: {
    chatId: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
    metadata?: unknown
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    // For WebSocket, reconnection is handled by re-establishing the connection
    // The Agent should send any pending messages on reconnect
    
    try {
      const ws = await this.ensureConnection(options.chatId)
      
      // Send reconnect request
      ws.send(JSON.stringify({
        type: 'reconnect',
        chatId: options.chatId,
        metadata: options.metadata
      }))
      
      // Return null if no active stream (Agent will respond with history instead)
      // In a full implementation, you'd check if there's an active stream to resume
      return null
    } catch (error) {
      console.error('[WS Transport] Reconnect failed:', error)
      return null
    }
  }
  
  /**
   * Close the WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connectionPromise = null
  }
  
  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

/**
 * Factory function to create a WebSocket transport
 */
export function createWebSocketChatTransport(
  options: WebSocketChatTransportOptions
): WebSocketChatTransport {
  return new WebSocketChatTransport(options)
}
