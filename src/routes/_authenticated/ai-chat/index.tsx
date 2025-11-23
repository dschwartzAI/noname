import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useInvalidateConversations } from '@/hooks/use-conversations'
import { useAgentChatSession } from '@/hooks/use-agent-chat'
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

  // Get auth context for WebSocket
  const { user } = useAuth()
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
      setMessages([])
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

  // Agents SDK chat integration
  const agentSession = useAgentChatSession({
    model: selectedModel,
    conversationId: effectiveConversationId,
    userId: user?.id,
    organizationId,
    agentId,

    // Artifact event handlers (kept for backward compatibility)
    onArtifactMetadata: useCallback(({ artifactId, metadata }) => {
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
    }, []),

    onArtifactDelta: useCallback(({ artifactId, delta }) => {
      // Update artifact content (full content sent each time)
      setArtifacts((prev) =>
        prev.map((artifact) =>
          artifact.id === artifactId
            ? { ...artifact, content: delta.content || delta, updatedAt: Date.now() }
            : artifact
        )
      )
    }, []),

    onArtifactComplete: useCallback(({ artifactId, messageId, artifact: finalData }) => {
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
    }, [invalidateConversations]),
  })

  // Use Agents SDK messages state
  const [messages, setMessages] = useState(agentSession.messages)
  const isLoading = agentSession.isLoading || agentSession.isStreaming
  const error = agentSession.error ? { message: agentSession.error.message } : null
  const isConnected = agentSession.isConnected

  // Map Agents SDK state to useChat-compatible status for UI components
  const status = agentSession.isStreaming
    ? 'streaming'
    : agentSession.isLoading
      ? 'submitted'  // Show thinking indicator when loading
      : agentSession.isConnected
        ? 'awaiting_message'
        : 'idle'

  // Refresh the sidebar once a message finishes streaming/saving
  const wasInFlightRef = useRef(false)
  useEffect(() => {
    const inFlight = agentSession.isLoading || agentSession.isStreaming
    if (wasInFlightRef.current && !inFlight && messages.length > 0) {
      invalidateConversations()
    }
    wasInFlightRef.current = inFlight
  }, [agentSession.isLoading, agentSession.isStreaming, messages.length, invalidateConversations])

  // Clear agent history when conversation changes (prevent message merging)
  // Use ref to track previous conversationId to avoid infinite loops
  const prevConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevConversationIdRef.current && prevConversationIdRef.current !== effectiveConversationId) {
      console.log('🔄 Conversation changed, clearing agent history from', prevConversationIdRef.current, 'to', effectiveConversationId)
      // Clear Agents SDK history to prevent messages from different conversations merging
      if (agentSession.clearHistory) {
        agentSession.clearHistory()
      }
      // Clear approved tool IDs for new conversation
      setApprovedToolIds(new Set())
    }
    prevConversationIdRef.current = effectiveConversationId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConversationId]) // Only depend on conversationId, not clearHistory function

  // Sync Agents SDK messages to local state
  useEffect(() => {
    setMessages(agentSession.messages)
  }, [agentSession.messages])

  // Load messages from backend when conversation data is fetched
  useEffect(() => {
    if (conversationData && typeof conversationData === 'object' && 'messages' in conversationData && Array.isArray(conversationData.messages)) {
      setMessages(conversationData.messages.map((msg: any) => {
        const content = extractMessageContent(msg)
        
        // Reconstruct parts if possible for rich history rendering
        // This allows displaying tool calls from history
        let parts: any[] = []
        
        // 1. Add text content part
        if (content) {
          parts.push({ type: 'text', text: content })
        } else if (!content && (!msg.toolCalls || msg.toolCalls.length === 0)) {
          // Empty message fallback
          parts.push({ type: 'text', text: '' })
        }
        
        // 2. Add tool call parts
        if (msg.toolCalls) {
          try {
            const toolCalls = typeof msg.toolCalls === 'string' 
              ? JSON.parse(msg.toolCalls) 
              : msg.toolCalls
              
            toolCalls.forEach((tc: any) => {
              parts.push({
                type: 'tool-invocation',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.input,
                state: tc.output ? 'result' : 'call',
                result: tc.output
              })
            })
          } catch (e) {
            console.error('Failed to parse tool calls from history:', e)
          }
        }

        return {
          id: msg.id,
          role: msg.role,
          content: content,
          parts: parts.length > 0 ? parts : [{ type: 'text', text: content || '' }],
        }
      }))
    }
  }, [conversationData, setMessages])

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

      if (!isConnected) {
        console.error('❌ [Chat Page] Agents SDK not connected');
        return;
      }

      try {
        console.log('➡️ [Chat Page] Calling agentSession.sendMessage...');
        // Send via Agents SDK (context already passed in hook initialization)
        await agentSession.sendMessage(text);

        console.log('✅ [Chat Page] agentSession.sendMessage completed');

        // Invalidate conversations list on first message
        if (messages.length === 0) {
          invalidateConversations();
        }

        // No need to navigate - conversationId is already in search params from New Chat logic
        // This prevents switching from WebSocket route to old HTTP route
      } catch (err) {
        console.error('❌ [Chat Page] Send failed:', err);
      }
    },
    [agentSession.sendMessage, isConnected, messages.length, invalidateConversations]
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
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
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
                          // Skip showing tool invocations that are just "thinking" or internal if desired
                          // But generally we want to show all tool calls
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
              ))}

              {/* Thinking indicator - show when AI is processing */}
              {(status === 'submitted' || status === 'streaming') && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {status === 'submitted' ? 'Thinking...' : 'Streaming...'}
                      </span>
                    </div>
                  </MessageContent>
                </Message>
              )}

              {/* Tool Confirmation Cards (requires human approval) */}
              {agentSession.rawMessages.map((msg) =>
                msg.parts?.map((part: any, partIndex: number) => {
                  // Check if this is a tool part that needs confirmation
                  // AND hasn't already been approved (to prevent loop)
                  if (
                    isToolUIPart(part) &&
                    part.state === 'input-available' &&
                    !part.output &&
                    !approvedToolIds.has(part.toolCallId)
                  ) {
                    return (
                      <div key={`${msg.id}-tool-${part.toolCallId}-${partIndex}`} className="px-4 mb-4">
                        <ToolConfirmationCard
                          toolName={part.type.replace('tool-', '')}
                          toolCallId={part.toolCallId}
                          input={part.input}
                          onConfirm={(toolCallId, result) => {
                            // Mark as approved immediately to hide the card
                            setApprovedToolIds(prev => new Set(prev).add(toolCallId));
                            // Call the actual confirm function
                            agentSession.confirmTool(toolCallId, result);
                          }}
                        />
                      </div>
                    );
                  }
                  return null;
                })
              )}

              {/* Artifact cards (clickable to toggle panel) */}
              {artifacts.length > 0 && (
                <div className="space-y-2 px-4">
                  {artifacts.map((artifact, index) => (
                    <ArtifactPreviewCard
                      key={artifact.id}
                      artifact={artifact}
                      onClick={() => {
                        // Toggle panel: if clicking same card, close panel; otherwise open/switch
                        if (isPanelOpen && currentArtifactIndex === index) {
                          setIsPanelOpen(false)
                        } else {
                          setCurrentArtifactIndex(index)
                          setIsPanelOpen(true)
                        }
                      }}
                      isSelected={isPanelOpen && currentArtifactIndex === index}
                    />
                  ))}
                </div>
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
                placeholder={!isConnected ? "Connecting..." : "Send a message..."}
                disabled={!isConnected || status === 'submitted' || status === 'streaming'}
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

              <PromptInputSubmit status={status} />
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
