/**
 * Custom hook for WebSocket-based AI chat
 * 
 * Combines useChat from @ai-sdk/react with WebSocket connection management
 * for Cloudflare Agents backend.
 * 
 * This hook:
 * 1. Manages WebSocket connection state separately from chat state
 * 2. Creates transport with proper callback wiring
 * 3. Exposes both connection status and chat status
 * 
 * IMPORTANT: This hook must be called unconditionally to satisfy React's rules of hooks.
 * It handles empty/placeholder values gracefully.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { WebSocketChatTransport } from '@/lib/websocket-chat-transport'

export interface UseWebSocketChatOptions {
  /**
   * Unique chat/conversation ID
   */
  chatId: string
  
  /**
   * Agent ID for this chat session
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
   * Optional model override
   */
  model?: string
  
  /**
   * Called when a message finishes streaming
   */
  onFinish?: () => void
  
  /**
   * Called on error
   */
  onError?: (error: Error) => void
  
  /**
   * Tools requiring user confirmation before execution
   */
  toolsRequiringConfirmation?: string[]
  
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

export interface UseWebSocketChatReturn {
  // Chat state from useChat
  messages: ReturnType<typeof useChat>['messages']
  status: ReturnType<typeof useChat>['status']
  error: ReturnType<typeof useChat>['error']
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  addToolOutput: ReturnType<typeof useChat>['addToolOutput']
  setMessages: ReturnType<typeof useChat>['setMessages']
  
  // Connection state (separate from chat status)
  isConnected: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error'
  
  // Actions
  connect: () => void
  disconnect: () => void
  clearHistory: () => void
}

export function useWebSocketChat({
  chatId,
  agentId,
  userId,
  organizationId,
  model,
  onFinish,
  onError,
  toolsRequiringConfirmation = [],
  onArtifactStart,
  onArtifactDelta,
  onArtifactComplete
}: UseWebSocketChatOptions): UseWebSocketChatReturn {
  
  // Connection state - managed separately from useChat
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  
  // Track if we have valid params to connect
  const canConnect = Boolean(agentId && userId && chatId)
  
  // Create a stable transport key for memoization
  // Only recreate transport when these ACTUAL values change (not boolean flags)
  const transportKey = `${agentId || 'none'}-${userId || 'none'}-${organizationId || 'none'}-${model || 'default'}`
  
  // Use ref to track if we've logged the transport creation
  const hasLoggedRef = useRef<string | null>(null)
  
  // Store artifact callbacks in refs to avoid transport recreation
  const artifactCallbacksRef = useRef({
    onArtifactStart,
    onArtifactDelta,
    onArtifactComplete
  })
  
  // Update refs when callbacks change
  useEffect(() => {
    artifactCallbacksRef.current = {
      onArtifactStart,
      onArtifactDelta,
      onArtifactComplete
    }
  }, [onArtifactStart, onArtifactDelta, onArtifactComplete])

  // Create transport instance - memoized to prevent recreation
  // IMPORTANT: This must be stable across renders for useChat to work
  // We use transportKey as the ONLY dependency to prevent unnecessary recreations
  const transport = useMemo(() => {
    // Log only once per unique key
    if (hasLoggedRef.current !== transportKey) {
      console.log('[useWebSocketChat] Creating transport with key:', transportKey)
      hasLoggedRef.current = transportKey
    }
    
    return new WebSocketChatTransport({
      agentId: agentId || 'placeholder',
      userId: userId || 'placeholder',
      organizationId: organizationId || 'placeholder',
      model,
      onOpen: () => {
        console.log('[useWebSocketChat] WebSocket connected')
        setConnectionState('connected')
      },
      onClose: () => {
        console.log('[useWebSocketChat] WebSocket disconnected')
        setConnectionState('disconnected')
      },
      onError: () => {
        console.log('[useWebSocketChat] WebSocket error')
        setConnectionState('error')
      },
      // Artifact callbacks - use refs to avoid transport recreation
      onArtifactStart: (data) => artifactCallbacksRef.current.onArtifactStart?.(data),
      onArtifactDelta: (data) => artifactCallbacksRef.current.onArtifactDelta?.(data),
      onArtifactComplete: (data) => artifactCallbacksRef.current.onArtifactComplete?.(data),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportKey])
  
  // Use AI SDK useChat with our transport
  // IMPORTANT: This hook must always be called, never conditionally
  const {
    messages,
    status,
    error,
    sendMessage: sdkSendMessage,
    addToolOutput,
    setMessages
  } = useChat({
    id: chatId || 'placeholder',
    transport,
    onToolCall: async ({ toolCall }) => {
      // Tools that need user confirmation - don't auto-execute
      if (toolsRequiringConfirmation.includes(toolCall.toolName)) {
        return undefined
      }
      return undefined
    },
    onFinish: () => {
      onFinish?.()
    },
    onError: (err) => {
      console.error('[useWebSocketChat] Chat error:', err)
      onError?.(err)
    }
  })
  
  /**
   * Connect to WebSocket (no-op, transport connects on send)
   */
  const connect = useCallback(() => {
    if (!canConnect) return
    setConnectionState('connecting')
  }, [canConnect])
  
  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    transport.disconnect()
    setConnectionState('disconnected')
  }, [transport])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      transport.disconnect()
    }
  }, [transport])
  
  /**
   * Wrapped sendMessage that handles connection state
   */
  const sendMessage = useCallback(async (message: Parameters<typeof sdkSendMessage>[0]) => {
    if (!canConnect) {
      console.warn('[useWebSocketChat] Cannot send - missing required params')
      return
    }
    
    // Update state to show we're connecting
    if (connectionState === 'disconnected') {
      setConnectionState('connecting')
    }
    
    // Send the message - transport will handle connection
    return sdkSendMessage(message)
  }, [sdkSendMessage, canConnect, connectionState])
  
  /**
   * Clear chat history
   */
  const clearHistory = useCallback(() => {
    setMessages([])
  }, [setMessages])
  
  // Derive isConnected boolean for convenience
  const isConnected = connectionState === 'connected'
  
  return {
    // Chat state
    messages,
    status,
    error,
    sendMessage,
    addToolOutput,
    setMessages,
    
    // Connection state
    isConnected,
    connectionState,
    
    // Actions
    connect,
    disconnect,
    clearHistory
  }
}
