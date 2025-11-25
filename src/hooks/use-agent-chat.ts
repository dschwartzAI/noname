/**
 * React hook for Cloudflare Agents SDK chat integration
 *
 * Connects to Chat Agent Durable Object via WebSocket and provides
 * a streaming chat interface compatible with AI SDK patterns.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { UIMessage } from 'ai'

interface UseAgentChatSessionProps {
  /**
   * Agent ID to use for this chat session
   */
  agentId: string

  /**
   * Conversation ID for loading/persisting history
   */
  conversationId?: string

  /**
   * User ID for multi-tenant isolation
   */
  userId: string

  /**
   * Organization ID for multi-tenant isolation
   */
  organizationId: string

  /**
   * Initial messages loaded from database
   */
  initialMessages?: UIMessage[]

  /**
   * Auto-connect to agent on mount
   */
  autoConnect?: boolean
}

interface AgentChatSessionState {
  /**
   * Current messages in the conversation
   */
  messages: UIMessage[]

  /**
   * WebSocket connection status
   */
  isConnected: boolean

  /**
   * AI is currently generating a response
   */
  isLoading: boolean

  /**
   * Error message if connection/message fails
   */
  error: string | null

  /**
   * Current conversation ID (may be generated)
   */
  conversationId: string | null

  /**
   * Raw messages from Agents SDK (includes full message objects)
   */
  rawMessages: UIMessage[]
}

interface AgentChatSessionActions {
  /**
   * Send a user message to the agent
   */
  sendMessage: (content: string) => void

  /**
   * Confirm a tool call (human-in-the-loop)
   */
  confirmTool: (toolCallId: string, result?: any) => void

  /**
   * Connect to the agent WebSocket
   */
  connect: () => void

  /**
   * Disconnect from the agent
   */
  disconnect: () => void

  /**
   * Clear all messages
   */
  clearMessages: () => void

  /**
   * Set messages (for loading from DB)
   */
  setMessages: (messages: UIMessage[]) => void
}

export function useAgentChatSession({
  agentId,
  conversationId,
  userId,
  organizationId,
  initialMessages = [],
  autoConnect = true
}: UseAgentChatSessionProps): AgentChatSessionState & AgentChatSessionActions {

  const [state, setState] = useState<AgentChatSessionState>({
    messages: initialMessages,
    rawMessages: initialMessages,
    isConnected: false,
    isLoading: false,
    error: null,
    conversationId: conversationId || null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef<number>(0)

  /**
   * Connect to Chat Agent via WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Build WebSocket URL for Chat Agent Durable Object
      const wsUrl = new URL('/api/agents/chat/websocket', window.location.origin)
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'

      // Pass context via query params
      wsUrl.searchParams.set('agentId', agentId)
      wsUrl.searchParams.set('userId', userId)
      wsUrl.searchParams.set('organizationId', organizationId)
      if (state.conversationId) {
        wsUrl.searchParams.set('conversationId', state.conversationId)
      }

      const ws = new WebSocket(wsUrl.toString())
      wsRef.current = ws

      ws.onopen = () => {
        console.log('🔌 Connected to Chat Agent')
        reconnectAttemptRef.current = 0 // Reset backoff on successful connection
        setState(prev => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          error: null
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle different message types from Agents SDK
          switch (data.type) {
            case 'messages':
              // Full message sync from agent
              setState(prev => ({
                ...prev,
                rawMessages: data.messages,
                messages: data.messages
              }))
              break

            case 'message':
              // Single message update
              setState(prev => ({
                ...prev,
                rawMessages: [...prev.rawMessages, data.message],
                messages: [...prev.messages, data.message]
              }))
              break

            case 'stream_start':
              setState(prev => ({ ...prev, isLoading: true }))
              break

            case 'stream_end':
              setState(prev => ({ ...prev, isLoading: false }))
              break

            case 'conversation_created':
              // Conversation ID assigned by backend
              setState(prev => ({
                ...prev,
                conversationId: data.conversationId
              }))
              break

            case 'error':
              setState(prev => ({
                ...prev,
                isLoading: false,
                error: data.message || 'Chat error occurred'
              }))
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        console.log('🔌 Disconnected from Chat Agent')
        setState(prev => ({ ...prev, isConnected: false, isLoading: false }))

        // Auto-reconnect with exponential backoff
        if (autoConnect) {
          const attempt = reconnectAttemptRef.current
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30s
          reconnectAttemptRef.current += 1

          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${attempt + 1})`)
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, delay)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
          error: 'Connection error'
        }))
      }

    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to establish connection'
      }))
    }
  }, [agentId, userId, organizationId, state.conversationId, autoConnect])

  /**
   * Disconnect from agent
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isLoading: false
    }))
  }, [])

  /**
   * Send a user message
   */
  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'Not connected' }))
      return
    }

    // Create user message
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [
        {
          type: 'text',
          text: content
        }
      ],
      metadata: {
        createdAt: new Date().toISOString()
      }
    }

    // Optimistically add to UI
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      rawMessages: [...prev.rawMessages, userMessage],
      isLoading: true,
      error: null
    }))

    // Send to agent via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      content,
      metadata: {
        userId,
        organizationId,
        agentId,
        conversationId: state.conversationId
      }
    }))
  }, [userId, organizationId, agentId, state.conversationId])

  /**
   * Confirm a tool call (human-in-the-loop)
   */
  const confirmTool = useCallback((toolCallId: string, result?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'Not connected' }))
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'tool_confirmation',
      toolCallId,
      result: result || { confirmed: true }
    }))
  }, [])

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      rawMessages: []
    }))
  }, [])

  /**
   * Set messages (for loading from DB)
   */
  const setMessages = useCallback((messages: UIMessage[]) => {
    setState(prev => ({
      ...prev,
      messages,
      rawMessages: messages
    }))
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Update initial messages when they change
  useEffect(() => {
    if (initialMessages.length > 0 && state.messages.length === 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages, state.messages.length, setMessages])

  return {
    ...state,
    sendMessage,
    confirmTool,
    connect,
    disconnect,
    clearMessages,
    setMessages
  }
}
