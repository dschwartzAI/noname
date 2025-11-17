import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useInvalidateConversations } from '@/hooks/use-conversations'
import { getAgentIconSrc, getAgentEmoji } from '@/features/ai-chat/utils/get-agent-icon'
import { ArtifactSidePanel } from '@/components/artifacts/artifact-side-panel'
import { ArtifactPreviewCard } from '@/components/artifacts/artifact-preview-card'
import type { Artifact } from '@/types/artifacts'
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

function ChatPage() {
  const { new: newChatKey, conversationId: urlConversationId, agentId } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const invalidateConversations = useInvalidateConversations()

  // Fetch agent details if agentId is provided
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

  // Track if we've navigated to this conversation URL yet
  const hasNavigatedRef = useRef(false)

  // Sync URL conversationId to effectiveConversationId (when navigating to existing conversation)
  // Only depend on urlConversationId to prevent re-triggering when effectiveConversationId changes
  useEffect(() => {
    if (urlConversationId && urlConversationId !== effectiveConversationId) {
      console.log('🔄 URL conversationId changed, syncing:', urlConversationId)
      setEffectiveConversationId(urlConversationId)
      hasNavigatedRef.current = true
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
      // Reset navigation flag for new conversation
      hasNavigatedRef.current = false
      // Clear artifacts and messages for new chat
      setArtifacts([])
      setMessages([])
      setIsPanelOpen(false)

      // Update URL immediately with new conversationId (preserve agentId)
      console.log('🔗 New chat - updating URL with new conversationId:', newId, 'agentId:', agentId)
      navigate({
        to: '/ai-chat',
        search: { conversationId: newId, agentId },
        replace: true,
      })
    }
  }, [newChatKey, currentChatKey, navigate, agentId])

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

  // Initialize artifacts as empty - loading happens in useEffect below
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0)

  // Track artifacts created during current streaming session (to update with messageId later)
  const pendingArtifactIdsRef = useRef<Set<string>>(new Set())

  // Use AI SDK's useChat hook for message management (replaces manual stream consumption)
  const chatHook = useChat({
    id: effectiveConversationId,
    streamProtocol: 'data',
    api: '/api/v1/chat',

    // Headers and credentials
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',

    // Static body (dynamic values passed in sendMessage)
    body: {
      conversationId: effectiveConversationId,
    },

    // Handle custom artifact data parts from backend
    onToolCall: ({ toolCall }) => {
      console.log('🔧 Tool call:', toolCall.toolName)
    },

    // Handle streaming data parts (artifacts)
    onData(data: unknown) {
      // Handle artifact metadata (create artifact and auto-open panel)
      if (data && typeof data === 'object' && 'type' in data) {
        const dataPart = data as any

        if (dataPart.type === 'data-artifact-metadata') {
          const { id, data: artifactData } = dataPart

          // Track this artifact ID for later messageId update
          pendingArtifactIdsRef.current.add(id)

          setArtifacts((prev) => {
            const now = Date.now()

            // Map backend 'kind' to frontend 'type'
            let artifactType = artifactData.kind || 'document'
            if (artifactType === 'text') {
              artifactType = 'markdown'  // Convert 'text' to 'markdown' for proper rendering
            }

            const newArtifact: Artifact = {
              id,
              title: artifactData.title || 'Untitled',
              type: artifactType,
              content: '',
              language: artifactData.language,
              createdAt: now,
              updatedAt: now,
              metadata: {}, // messageId will be added in onFinish
            }
            const newIndex = prev.length

            // Auto-open panel when artifact is created
            setIsPanelOpen(true)
            setCurrentArtifactIndex(newIndex)

            return [...prev, newArtifact]
          })
        }

        // Handle artifact delta (full content sent each time, not incremental)
        if (dataPart.type === 'data-artifact-delta') {
          const { id, data: content } = dataPart

          setArtifacts((prev) =>
            prev.map((artifact) =>
              artifact.id === id
                ? { ...artifact, content, updatedAt: Date.now() }
                : artifact
            )
          )
        }

        // Handle artifact complete
        if (dataPart.type === 'data-artifact-complete') {
          const { id, data: finalData } = dataPart

          setArtifacts((prev) =>
            prev.map((artifact) => {
              if (artifact.id === id) {
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
                }
              }
              return artifact
            })
          )
        }
      }
    },

    // Error handling
    onError: (error) => {
      console.error('❌ Chat error:', error)
    },

    // Success callback - refresh conversation list and update artifacts with messageId
    onFinish: ({ message, messages, isAbort, isError }) => {
      console.log('✅ Message complete:', message?.id)
      invalidateConversations()

      // Update pending artifacts with the assistant message ID
      if (message?.id && pendingArtifactIdsRef.current.size > 0) {
        console.log('📝 Adding messageId to', pendingArtifactIdsRef.current.size, 'artifact(s)')
        console.log('   Pending artifact IDs:', Array.from(pendingArtifactIdsRef.current))
        console.log('   Message ID:', message.id)

        setArtifacts((prev) => {
          console.log('   Current artifacts:', prev.map(a => ({ id: a.id, hasMessageId: !!a.metadata.messageId })))

          const updated = prev.map((artifact) => {
            if (pendingArtifactIdsRef.current.has(artifact.id)) {
              console.log('   ✅ Updating artifact:', artifact.id, 'with messageId:', message.id)
              return {
                ...artifact,
                metadata: {
                  ...artifact.metadata,
                  messageId: message.id,
                },
              }
            }
            return artifact
          })

          console.log('   Updated artifacts:', updated.map(a => ({ id: a.id, messageId: a.metadata.messageId })))
          return updated
        })

        // Clear pending artifacts
        pendingArtifactIdsRef.current.clear()
      } else if (pendingArtifactIdsRef.current.size > 0) {
        console.warn('⚠️ Artifacts missing messageId - count:', pendingArtifactIdsRef.current.size)
      }

      // Update URL with conversationId if first message
      // Navigate to dynamic route ($conversationId.tsx) for better persistence
      if (!hasNavigatedRef.current && !urlConversationId) {
        hasNavigatedRef.current = true
        navigate({
          to: '/ai-chat/$conversationId',
          params: { conversationId: effectiveConversationId },
          search: { agentId },
          replace: true,
        })
      }
    },
  })

  // Destructure hook with fallbacks
  const {
    messages = [],
    sendMessage,
    error,
    setMessages,
    status,
  } = chatHook || {}

  // Load messages from backend when conversation data is fetched
  useEffect(() => {
    if (conversationData && typeof conversationData === 'object' && 'messages' in conversationData && Array.isArray(conversationData.messages)) {
      setMessages(conversationData.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        parts: [{ type: 'text', text: msg.content }], // Add parts for rendering
      })))
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

  // Simple message handler using useChat hook
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text?.trim()) return

      if (typeof sendMessage !== 'function') {
        console.error('❌ sendMessage not initialized')
        return
      }

      try {
        // Pass dynamic values (agentId, model) via request-level options
        await sendMessage(
          {
            role: 'user',
            parts: [{ type: 'text', text }],
          },
          {
            body: {
              conversationId: effectiveConversationId,
              model: selectedModel,
              agentId: agentId, // Current agentId value
            },
          }
        )
      } catch (err) {
        console.error('❌ Send failed:', err)
      }
    },
    [sendMessage, selectedModel, agentId, effectiveConversationId]
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Chat Area */}
      <div className={`flex flex-col h-full transition-all duration-300 ${isPanelOpen ? 'w-1/2' : 'w-full'}`}>
      {/* Header */}
      <div className="border-b p-4">
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
      <Conversation className="flex-1 overflow-y-auto">
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
                    <MessageResponse>
                      {message.parts
                        ?.filter(part => part.type === 'text')
                        .map((part: any) => part.text)
                        .join('') || ''}
                    </MessageResponse>
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
      <div className="border-t p-4">
        <PromptInput
          onSubmit={(message) => {
            if (message.text?.trim()) {
              handleSendMessage(message.text)
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Send a message..."
              disabled={status === 'submitted' || status === 'streaming'}
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

      {/* Artifact Side Panel */}
      {isPanelOpen && artifacts.length > 0 && (() => {
        const currentArtifact = artifacts[currentArtifactIndex]
        const messageId = currentArtifact?.metadata?.messageId
        console.log('🎨 Rendering ArtifactSidePanel:', {
          artifactId: currentArtifact?.id,
          messageId: messageId,
          metadata: currentArtifact?.metadata,
        })
        return (
          <ArtifactSidePanel
            artifacts={artifacts}
            currentIndex={currentArtifactIndex}
            onIndexChange={setCurrentArtifactIndex}
            onClose={() => setIsPanelOpen(false)}
            conversationId={effectiveConversationId}
            messageId={messageId as string | undefined}
            onArtifactUpdate={(updatedArtifact) => {
            setArtifacts((prev) =>
              prev.map((a) => (a.id === updatedArtifact.id ? updatedArtifact : a))
            )
          }}
          className="w-1/2 h-full"
        />
        )
      })()}
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
