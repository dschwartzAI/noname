import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { useInvalidateConversations } from '@/hooks/use-conversations'
// Custom hook that combines useChat with WebSocket connection management
import { useWebSocketChat } from '@/hooks/use-websocket-chat'
import { useAuth } from '@/stores/auth-simple'
import { getAgentIconSrc, getAgentEmoji } from '@/features/ai-chat/utils/get-agent-icon'
import { ArtifactSidePanel } from '@/components/artifacts/artifact-side-panel'
import { ArtifactPreviewCard } from '@/components/artifacts/artifact-preview-card'
import { ToolConfirmationCard } from '@/components/ai-elements/tool-confirmation-card'
import { ToolInvocation } from '@/components/ai-elements/tool-invocation'
import type { Artifact } from '@/types/artifacts'
import { isToolUIPart } from 'ai'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
} from '@/components/ai-elements/prompt-input'
import { PaperclipIcon } from 'lucide-react'

// Suggested prompts for empty state
const SUGGESTED_PROMPTS = [
  'What are the advantages of using Next.js?',
  'Help me write an essay about Silicon Valley',
  'Write code to implement a binary search tree',
  'What is the capital of France?',
]

// Available AI models
const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { value: 'grok-2-latest', label: 'Grok 2', provider: 'xAI' },
]

// Store generated conversation IDs to survive React StrictMode double-mounting
const conversationIdCache = new Map<string, string>()

// Helper function to extract text content from database messages
// Historical messages don't need tool parts - those are already processed
function extractMessageContent(msg: any) {
  // Just return text content - tool calls are already in the database
  // and don't need to be sent back to the backend
  return msg.content || ''
}

function ChatPage() {
  const { new: newChatKey, conversationId: urlConversationId, agentId: urlAgentId } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const invalidateConversations = useInvalidateConversations()
  const queryClient = useQueryClient()

  // Get auth context for WebSocket
  const { user, isLoading: isAuthLoading } = useAuth()
  // TODO: Get organization from user membership - for now hardcode
  const organizationId = 'soloos-org-id-2025'

  // Generate conversation ID upfront (like Vercel AI Chatbot pattern)
  // Use URL conversationId if present, otherwise generate new one
  // Cache the ID to survive React StrictMode double-mounting
  const [conversationId] = useState(() => {
    if (urlConversationId) {
      console.log('🆔 Using URL conversationId:', urlConversationId)
      return urlConversationId
    }

    // Use cache key based on current route/params to ensure stability
    const cacheKey = `new-chat-${newChatKey || 'default'}`
    if (conversationIdCache.has(cacheKey)) {
      const cachedId = conversationIdCache.get(cacheKey)!
      console.log('🆔 Reusing cached conversationId:', cachedId)
      return cachedId
    }

    const id = nanoid()
    conversationIdCache.set(cacheKey, id)
    console.log('🆔 Generated new conversationId:', id)
    return id
  })

  // Force regenerate conversation ID when newChatKey changes (New Chat clicked)
  const [currentChatKey, setCurrentChatKey] = useState(newChatKey || 'initial')
  const [effectiveConversationId, setEffectiveConversationId] = useState(urlConversationId || conversationId)

  // Sync URL conversationId to effectiveConversationId (when navigating to existing conversation)
  // Only depend on urlConversationId to prevent re-triggering when effectiveConversationId changes
  useEffect(() => {
    if (urlConversationId && urlConversationId !== effectiveConversationId) {
      console.log('🔄 URL conversationId changed, syncing:', urlConversationId)
      setEffectiveConversationId(urlConversationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId]) // Only trigger on URL change, not effectiveConversationId

  useEffect(() => {
    if (newChatKey && newChatKey !== currentChatKey) {
      // New chat triggered - generate fresh conversation ID
      const newId = nanoid()

      // Update cache for this new chat key
      const cacheKey = `new-chat-${newChatKey}`
      conversationIdCache.set(cacheKey, newId)

      setEffectiveConversationId(newId)
      setCurrentChatKey(newChatKey)
      // Clear artifacts and messages for new chat
      setArtifacts([])
      clearHistory() // SDK method to clear message history
      setIsPanelOpen(false)

      // Update URL immediately with new conversationId (preserve agentId from URL)
      console.log('🔗 New chat - updating URL with new conversationId:', newId, 'agentId:', urlAgentId)
      navigate({
        to: '/ai-chat',
        search: { conversationId: newId, agentId: urlAgentId },
        replace: true,
      })
    }
  }, [newChatKey, currentChatKey, navigate, urlAgentId])

  // If we're on /ai-chat without a conversationId, push the generated ID into the URL
  // BUT: Skip this if we're in the middle of creating a new chat (newChatKey exists)
  // to avoid fighting with the new chat effect above
  useEffect(() => {
    if (!urlConversationId && effectiveConversationId && !newChatKey) {
      navigate({
        to: '/ai-chat',
        search: { conversationId: effectiveConversationId, agentId: urlAgentId },
        replace: true,
      })
    }
  }, [urlConversationId, effectiveConversationId, navigate, urlAgentId, newChatKey])

  // Load existing conversation messages from backend if conversationId is present
  const { data: conversationData } = useQuery({
    queryKey: ['conversation', effectiveConversationId],
    queryFn: async () => {
      if (!effectiveConversationId) return null
      const response = await fetch(`/api/v1/chat/${effectiveConversationId}`, {
        credentials: 'include',
      })
      if (!response.ok) return null
      return response.json()
    },
    enabled: !!effectiveConversationId && !!urlConversationId, // Only load if navigating to existing conversation
  })

  // Derive agentId from conversation data if available, otherwise use URL param
  // Backend stores agentId as toolId field for backward compatibility
  const agentId = conversationData?.conversation?.toolId || urlAgentId

  // Fetch agent details if agentId is available
  const { data: agentData } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      if (!agentId) return null
      const response = await fetch(`/api/v1/agents/${agentId}`)
      if (!response.ok) return null
      const data = await response.json()
      return data.agent
    },
    enabled: !!agentId,
  })

  // Initialize artifacts as empty - loading happens in useEffect below
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0)

  // Track artifacts created during current streaming session (to update with messageId later)
  const pendingArtifactIdsRef = useRef<Set<string>>(new Set())

  // Track approved tool call IDs to hide confirmation cards immediately
  const [approvedToolIds, setApprovedToolIds] = useState<Set<string>>(new Set())

  // Artifact event handlers (custom - SDK doesn't manage artifacts)
  const onArtifactMetadata = useCallback(({ artifactId, metadata }: any) => {
    console.log('🎨 onArtifactMetadata called:', { artifactId, metadata });
    // Track this artifact ID for later messageId update
    pendingArtifactIdsRef.current.add(artifactId)

    setArtifacts((prev) => {
      const now = Date.now()

      // Map backend 'kind' to frontend 'type'
      let artifactType = metadata.kind || 'document'
      if (artifactType === 'text') {
        artifactType = 'markdown'  // Convert 'text' to 'markdown' for proper rendering
      }

      const newArtifact: Artifact = {
        id: artifactId,
        title: metadata.title || 'Untitled',
        type: artifactType,
        content: '',
        language: metadata.language,
        createdAt: now,
        updatedAt: now,
        metadata: {}, // messageId will be added later
      }
      const newIndex = prev.length

      // Auto-open panel when artifact is created
      setIsPanelOpen(true)
      setCurrentArtifactIndex(newIndex)

      return [...prev, newArtifact]
    })
  }, [])

  const onArtifactDelta = useCallback(({ artifactId, delta }: { artifactId: string; delta: string }) => {
    console.log('📝 onArtifactDelta called:', { artifactId, deltaLength: delta?.length });
    // Accumulate artifact content (delta is a string to append)
    setArtifacts((prev) =>
      prev.map((artifact) =>
        artifact.id === artifactId
          ? { ...artifact, content: (artifact.content || '') + delta, updatedAt: Date.now() }
          : artifact
      )
    )
  }, [])

  const onArtifactComplete = useCallback(({ artifactId, messageId, artifact: finalData }: any) => {
    console.log('✅ onArtifactComplete called:', { artifactId, messageId, title: finalData?.title });
    // Finalize artifact with complete data
    setArtifacts((prev) =>
      prev.map((artifact) => {
        if (artifact.id === artifactId) {
          // Map backend 'kind' to frontend 'type'
          let finalType = finalData.kind || artifact.type
          if (finalType === 'text') {
            finalType = 'markdown'
          }

          return {
            ...artifact,
            title: finalData.title || artifact.title,
            content: finalData.content || artifact.content,
            type: finalType,
            language: finalData.language || artifact.language,
            updatedAt: Date.now(),
            metadata: { messageId }, // Store messageId for saving later
          }
        }
        return artifact
      })
    )

    // Invalidate conversations list when artifact is complete
    invalidateConversations()
  }, [invalidateConversations])

  // Custom hook that manages WebSocket connection + useChat together
  // This properly handles connection state separate from chat streaming state
  // IMPORTANT: Hooks must be called unconditionally before any returns
  const {
    messages,
    status,
    error,
    sendMessage,
    addToolOutput,
    setMessages,
    isConnected,
    connectionState,
    clearHistory
  } = useWebSocketChat({
    chatId: effectiveConversationId,
    agentId: agentId || '', // Provide fallback to satisfy hook rules
    userId: user?.id || '', // Provide fallback to satisfy hook rules  
    organizationId,
    model: selectedModel,
    toolsRequiringConfirmation: ['searchUsers', 'createDocument'],
    onFinish: () => {
      // Refresh conversations list when response completes
      invalidateConversations()
    },
    onError: (err) => {
      console.error('Chat error:', err)
      toast.error('Chat error', { description: err.message })
    },
    // Artifact streaming callbacks
    onArtifactStart: ({ artifactId, title, kind }) => {
      console.log('🎨 [Chat Page] Artifact start:', { artifactId, title, kind })
      onArtifactMetadata({ 
        artifactId, 
        metadata: { title, kind } 
      })
    },
    onArtifactDelta: ({ artifactId, delta }) => {
      onArtifactDelta({ artifactId, delta })
    },
    onArtifactComplete: ({ artifactId, title, kind, content }) => {
      console.log('✅ [Chat Page] Artifact complete:', { artifactId, title })
      onArtifactComplete({ 
        artifactId, 
        messageId: messages[messages.length - 1]?.id,
        artifact: { title, kind, content } 
      })
    }
  })

  // Derive loading state from status
  const isLoading = status === 'streaming' || status === 'submitted'
  
  // Alias addToolOutput to addToolResult for compatibility
  const addToolResult = addToolOutput

  // Track send state for typing indicator
  const [isSending, setIsSending] = useState(false)

  // Map status to legacy format for UI components
  // Note: 'ready' means we can accept input (connected or will connect on send)
  const chatStatus = status === 'streaming'
    ? 'streaming'
    : isLoading
      ? 'submitted'  // Show thinking indicator when loading
      : 'ready' // Always ready - transport handles connection on send

  // Clear sending state when assistant response starts streaming
  // The status changes from 'submitted' to 'streaming' when the first chunk arrives
  // We want to show the "thinking" indicator ONLY during the 'submitted' phase
  useEffect(() => {
    // When streaming starts, clear the sending indicator
    if (status === 'streaming') {
      setIsSending(false)
    }
  }, [status])

  // Refresh the sidebar once a message finishes streaming/saving
  const wasInFlightRef = useRef(false)
  useEffect(() => {
    const inFlight = isLoading || status === 'streaming'
    if (wasInFlightRef.current && !inFlight && messages.length > 0) {
      invalidateConversations()
    }
    wasInFlightRef.current = inFlight
  }, [isLoading, status, messages.length, invalidateConversations])

  // Clear agent history when conversation changes (prevent message merging)
  // Use ref to track previous conversationId to avoid infinite loops
  const prevConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevConversationIdRef.current && prevConversationIdRef.current !== effectiveConversationId) {
      console.log('🔄 Conversation changed, clearing agent history from', prevConversationIdRef.current, 'to', effectiveConversationId)
      // Clear Agents SDK history to prevent messages from different conversations merging
      if (clearHistory) {
        clearHistory()
      }
      // Clear approved tool IDs for new conversation
      setApprovedToolIds(new Set())
    }
    prevConversationIdRef.current = effectiveConversationId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConversationId]) // Only depend on conversationId, not clearHistory function

  // NOTE: Conversation history is now loaded server-side in chat-agent.ts fetch()
  // The SDK manages message state internally, no need for client-side history loading

  // Load and persist artifacts - COMBINED into single effect to prevent cascading updates
  useEffect(() => {
    if (!effectiveConversationId) return

    const key = `artifacts-${effectiveConversationId}`

    // Load artifacts from localStorage when conversation changes
    const stored = localStorage.getItem(key)
    console.log('📂 Loading artifacts for conversation:', effectiveConversationId)
    if (stored) {
      try {
        const loaded = JSON.parse(stored)
        console.log('✅ Loaded', loaded.length, 'artifacts from localStorage')
        setArtifacts(loaded)
      } catch (e) {
        console.error('Failed to parse stored artifacts:', e)
        setArtifacts([])
      }
    } else {
      console.log('ℹ️ No stored artifacts found for this conversation')
      setArtifacts([])
    }

    // No cleanup needed - loading happens on conversation change only
  }, [effectiveConversationId])

  // Persist artifacts to localStorage whenever they change (separate effect to avoid loops)
  useEffect(() => {
    if (artifacts.length > 0 && effectiveConversationId) {
      const key = `artifacts-${effectiveConversationId}`
      localStorage.setItem(key, JSON.stringify(artifacts))
    }
  }, [artifacts, effectiveConversationId])

  // WebSocket message handler
  const handleSendMessage = useCallback(
    async (text: string) => {
      console.log('🔵 [Chat Page] handleSendMessage called', { text: text.substring(0, 50), isConnected });

      if (!text?.trim()) {
        console.log('⚠️ [Chat Page] Empty message, ignoring');
        return;
      }

      // Guard: Prevent double-sends
      if (isSending) {
        console.warn('⚠️ Already sending message, ignoring duplicate');
        return;
      }

      // Connection is handled by the hook - it will connect on first send if needed
      if (connectionState !== 'connected') {
        console.log('🔌 [Chat Page] Will connect on send, current state:', connectionState);
      }

      // Set sending state immediately for typing indicator
      setIsSending(true);

      // Optimistic sidebar update - add conversation immediately
      const existingConversations = queryClient.getQueryData(['conversations']) as any[] | undefined;
      const isNewConversation = !existingConversations?.find(c => c.id === effectiveConversationId);

      if (isNewConversation && agentData) {
        console.log('📋 Optimistic sidebar update:', effectiveConversationId);
        queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
          if (!old) return old;

          // Build conversation matching exact useConversations shape
          const optimisticConvo = {
            id: effectiveConversationId,
            title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
            agent: {
              id: agentData.id,
              name: agentData.name,
              avatar: agentData.avatar,
              icon: agentData.icon,
              greeting: '',
              model: agentData.model || selectedModel,
            },
            createdAt: new Date(), // Must be Date object
            updatedAt: new Date(), // Must be Date object
            lastMessage: undefined,
            messages: undefined,
          };

          return [optimisticConvo, ...old];
        });
      }

      // Performance logging - track first token latency
      const sendTime = performance.now();
      console.time('⏱️ first-token-latency');

      try {
        console.log('➡️ [Chat Page] Calling SDK sendMessage...');
        // Send via Agents SDK sendMessage (expects object payload)
        await sendMessage({ text });

        console.log('✅ [Chat Page] SDK sendMessage completed');

        // Clear draft on success
        localStorage.removeItem(`draft-${effectiveConversationId}`);

        // Invalidate conversations list on first message
        if (messages.length === 0) {
          invalidateConversations();
        }

        // No need to navigate - conversationId is already in search params from New Chat logic
        // This prevents switching from WebSocket route to old HTTP route
      } catch (err) {
        // Clear sending state on error
        setIsSending(false);

        // Save draft for retry
        localStorage.setItem(`draft-${effectiveConversationId}`, text);

        console.error('❌ [Chat Page] Send failed:', err);

        // Show error toast with retry option
        toast.error('Failed to send message', {
          description: err instanceof Error ? err.message : 'Please try again',
          action: {
            label: 'Retry',
            onClick: () => handleSendMessage(text),
          },
        });
      }
    },
    [sendMessage, isConnected, isSending, messages.length, invalidateConversations, effectiveConversationId, queryClient, agentData, selectedModel]
  )

  // ============================================================
  // ALL HOOKS MUST BE ABOVE THIS LINE
  // Early returns below are safe because all hooks have been called
  // ============================================================
  
  // Handle loading states - AFTER all hooks have been called
  if (isAuthLoading || !user?.id || !agentId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">
          {isAuthLoading ? 'Loading session...' : 'Loading user context...'}
        </div>
      </div>
    )
  }

  // Memoized message component to reduce re-renders during streaming
  const MemoizedMessage = React.memo(
    ({ message }: { message: any }) => {
      return (
        <Message from={message.role}>
          <MessageContent>
            {message.parts ? (
              // Render parts if available (rich content with tools)
              message.parts.map((part: any, idx: number) => {
                if (part.type === 'text') {
                  return (
                    <MessageResponse key={idx}>
                      {part.text}
                    </MessageResponse>
                  )
                }

                if (part.type === 'tool-invocation') {
                  const toolName = part.toolName || (part as any).name
                  return (
                    <div key={idx} className="my-2">
                      <ToolInvocation
                        toolName={toolName}
                        toolCallId={part.toolCallId}
                        state={part.state}
                        args={part.args}
                        result={part.result}
                      />
                    </div>
                  )
                }

                return null
              })
            ) : (
              // Fallback to content string
              <MessageResponse>
                {message.content || ''}
              </MessageResponse>
            )}
          </MessageContent>
        </Message>
      )
    },
    (prev, next) => {
      // Only re-render if message content actually changed
      const prevContent = prev.message.parts?.map((p: any) =>
        p.type === 'text' ? p.text : p.type
      ).join('|') || prev.message.content;
      const nextContent = next.message.parts?.map((p: any) =>
        p.type === 'text' ? p.text : p.type
      ).join('|') || next.message.content;

      return (
        prev.message.id === next.message.id &&
        prevContent === nextContent
      );
    }
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Chat Area */}
      <div className={`flex flex-col h-full min-h-0 transition-all duration-300 ${isPanelOpen ? 'w-1/2' : 'w-full'}`}>
      {/* Header */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Agent Icon */}
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {agentData && getAgentIconSrc(agentData) ? (
              <img
                src={getAgentIconSrc(agentData)!}
                alt={agentData.name}
                className="w-full h-full object-cover"
              />
            ) : agentData && getAgentEmoji(agentData) ? (
              <span className="text-xl">{getAgentEmoji(agentData)}</span>
            ) : (
              <Bot className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">{agentData?.name || 'AI Assistant'}</h2>
            <p className="text-xs text-muted-foreground">
              {agentData?.description || 'How can I help?'}
            </p>
          </div>
        </div>
      </div>

      {/* Connection status indicator */}
      {connectionState === 'connecting' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Connecting to chat...</span>
        </div>
      )}
      {connectionState === 'error' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-800">
          <span>Connection error. Will retry on next message.</span>
        </div>
      )}

      {/* Conversation Area with Auto-scroll */}
      <Conversation className="flex-1 min-h-0 overflow-y-auto pb-4">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Hello there! How can I help you today?"
              description=""
            >
              <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold text-center">
                  Hello there! How can I help you today?
                </h1>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="p-4 text-left text-sm border rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            <>
              {messages.map((message, messageIndex) => {
                // Find artifacts associated with this message
                const messageArtifacts = artifacts.filter(
                  (a) => a.metadata?.messageId === message.id
                );
                
                // Check for tool confirmation parts in this message
                const toolConfirmationParts = message.parts?.filter((part: any) => 
                  isToolUIPart(part) &&
                  part.state === 'input-available' &&
                  !part.output &&
                  !approvedToolIds.has(part.toolCallId)
                ) || [];
                
                return (
                  <React.Fragment key={message.id}>
                    {/* Render the message */}
                    <MemoizedMessage message={message} />
                    
                    {/* Render tool confirmation cards for this message */}
                    {toolConfirmationParts.map((part: any, partIndex: number) => (
                      <div key={`${message.id}-tool-${part.toolCallId}-${partIndex}`} className="px-4 mb-4">
                        <ToolConfirmationCard
                          toolName={part.type.replace('tool-', '')}
                          toolCallId={part.toolCallId}
                          input={part.input}
                          onConfirm={(toolCallId, result) => {
                            console.log('✅ Tool approved:', toolCallId);
                            setApprovedToolIds(prev => new Set(prev).add(toolCallId));
                            const toolName = part.type.replace('tool-', '');
                            addToolResult({ 
                              tool: toolName,
                              toolCallId, 
                              output: result 
                            });
                          }}
                        />
                      </div>
                    ))}
                    
                    {/* Render artifact cards associated with this message (inline) */}
                    {messageArtifacts.length > 0 && (
                      <div className="space-y-2 px-4 my-2">
                        {messageArtifacts.map((artifact) => {
                          const artifactIndex = artifacts.findIndex(a => a.id === artifact.id);
                          return (
                            <ArtifactPreviewCard
                              key={artifact.id}
                              artifact={artifact}
                              onClick={() => {
                                if (isPanelOpen && currentArtifactIndex === artifactIndex) {
                                  setIsPanelOpen(false)
                                } else {
                                  setCurrentArtifactIndex(artifactIndex)
                                  setIsPanelOpen(true)
                                }
                              }}
                              isSelected={isPanelOpen && currentArtifactIndex === artifactIndex}
                            />
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Artifacts without a messageId (orphaned or in-progress) - show at end */}
              {artifacts.filter(a => !a.metadata?.messageId).length > 0 && (
                <div className="space-y-2 px-4 my-2">
                  {artifacts.filter(a => !a.metadata?.messageId).map((artifact) => {
                    const artifactIndex = artifacts.findIndex(a => a.id === artifact.id);
                    return (
                      <ArtifactPreviewCard
                        key={artifact.id}
                        artifact={artifact}
                        onClick={() => {
                          if (isPanelOpen && currentArtifactIndex === artifactIndex) {
                            setIsPanelOpen(false)
                          } else {
                            setCurrentArtifactIndex(artifactIndex)
                            setIsPanelOpen(true)
                          }
                        }}
                        isSelected={isPanelOpen && currentArtifactIndex === artifactIndex}
                      />
                    );
                  })}
                </div>
              )}

              {/* Typing indicator - show when waiting for response */}
              {(isSending || status === 'submitted') && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Assistant is thinking...
                      </span>
                    </div>
                  </MessageContent>
                </Message>
              )}

              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                  Error: {error.message}
                </div>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div
        className="border-t bg-background/90 backdrop-blur flex-shrink-0 sticky bottom-0 z-20"
        style={{
          paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <div className="max-w-3xl mx-auto w-full px-4 pt-4">
          <PromptInput
            onSubmit={(message) => {
              if (message.text?.trim()) {
                handleSendMessage(message.text)
              }
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={connectionState === 'connecting' ? "Connecting..." : "Send a message..."}
                disabled={chatStatus === 'submitted' || chatStatus === 'streaming'}
              />
            </PromptInputBody>

            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton>
                  <PaperclipIcon className="h-4 w-4" />
                </PromptInputButton>

                {/* Model selector commented out - using agent's default model */}
                {/* <PromptInputSelect value={selectedModel} onValueChange={setSelectedModel}>
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue>
                      {MODELS.find(m => m.value === selectedModel)?.label}
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {MODELS.map((model) => (
                      <PromptInputSelectItem key={model.value} value={model.value}>
                        <div className="flex flex-col">
                          <span>{model.label}</span>
                          <span className="text-xs text-muted-foreground">{model.provider}</span>
                        </div>
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect> */}
              </PromptInputTools>

              <PromptInputSubmit status={chatStatus} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>

      {/* Artifact Side Panel */}
      {isPanelOpen && artifacts.length > 0 && (
        <ArtifactSidePanel
          artifacts={artifacts}
          currentIndex={currentArtifactIndex}
          onIndexChange={setCurrentArtifactIndex}
          onClose={() => setIsPanelOpen(false)}
          conversationId={effectiveConversationId}
          messageId={artifacts[currentArtifactIndex]?.metadata?.messageId as string | undefined}
          onArtifactUpdate={(updatedArtifact) => {
            setArtifacts((prev) =>
              prev.map((a) => (a.id === updatedArtifact.id ? updatedArtifact : a))
            )
          }}
          className="w-1/2 h-full"
        />
      )}
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat/')({
  component: ChatPage,
  // Allow search params for new chat, conversation ID, and agent selection
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new as string | undefined,
    conversationId: search.conversationId as string | undefined,
    agentId: search.agentId as string | undefined,
  }),
})
