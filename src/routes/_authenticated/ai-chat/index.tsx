import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { consumeStream } from 'ai'
import { useState, useRef, useEffect } from 'react'
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

function ChatPage() {
  const { new: newChatKey, conversationId: urlConversationId, agentId } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const invalidateConversations = useInvalidateConversations()

  console.log('🚀 ChatPage mounted - URL params:', { urlConversationId, agentId, newChatKey })

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
  const [conversationId] = useState(() => {
    const id = urlConversationId || nanoid()
    console.log('🆔 Initial conversationId:', id, urlConversationId ? '(from URL)' : '(generated)')
    return id
  })

  // Force regenerate conversation ID when newChatKey changes (New Chat clicked)
  const [currentChatKey, setCurrentChatKey] = useState(newChatKey || 'initial')
  const [effectiveConversationId, setEffectiveConversationId] = useState(urlConversationId || conversationId)

  // Track if we've navigated to this conversation URL yet
  const hasNavigatedRef = useRef(false)

  // Sync URL conversationId to effectiveConversationId (when navigating to existing conversation)
  useEffect(() => {
    if (urlConversationId && urlConversationId !== effectiveConversationId) {
      console.log('🔄 URL conversationId changed, syncing:', urlConversationId)
      setEffectiveConversationId(urlConversationId)
      hasNavigatedRef.current = true
    }
  }, [urlConversationId, effectiveConversationId])

  useEffect(() => {
    if (newChatKey && newChatKey !== currentChatKey) {
      // New chat triggered - generate fresh conversation ID
      const newId = nanoid()
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
  }, [newChatKey, currentChatKey, navigate])

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

  // Message and artifact state management (manual implementation)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; parts?: any[] }>>([])

  // Load messages from API when conversation data is fetched
  useEffect(() => {
    if (conversationData?.messages) {
      console.log('📥 Loading', conversationData.messages.length, 'messages from backend')
      setMessages(conversationData.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        parts: [{ type: 'text', text: msg.content }],
      })))
    }
  }, [conversationData])
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    // Load artifacts from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`artifacts-${effectiveConversationId}`)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse stored artifacts:', e)
        }
      }
    }
    return []
  })
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming' | 'error'>('idle')
  const [error, setError] = useState<Error | null>(null)

  // Persist artifacts to localStorage whenever they change
  useEffect(() => {
    if (artifacts.length > 0) {
      const key = `artifacts-${effectiveConversationId}`
      localStorage.setItem(key, JSON.stringify(artifacts))
      console.log('💾 Saved', artifacts.length, 'artifacts to', key)
    }
  }, [artifacts, effectiveConversationId])

  // Load artifacts from localStorage when conversation changes
  useEffect(() => {
    if (effectiveConversationId) {
      const key = `artifacts-${effectiveConversationId}`
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
    }
  }, [effectiveConversationId])

  // Manual stream parsing implementation
  const sendMessage = async (
    messageInput: { text?: string },
    options?: { body?: { conversationId?: string; model?: string; agentId?: string } }
  ) => {
    const text = messageInput.text
    if (!text?.trim()) return

    // Add user message immediately
    const userMessageId = nanoid()
    const userMessage = {
      id: userMessageId,
      role: 'user' as const,
      content: text,
      parts: [{ type: 'text', text }]
    }

    // Add placeholder assistant message
    const assistantMessageId = nanoid()
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: '',
      parts: [{ type: 'text', text: '' }]
    }

    // Update state with both messages at once
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    setStatus('submitted')
    setError(null)

    try {
      // Build messages array - include ALL messages + new user message
      // (excluding the placeholder assistant we just added)
      const messagesToSend = [...messages, userMessage]

      // Convert messages to AI SDK v5 format with parts array
      const aiMessages = messagesToSend.map((m) => ({
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
      }))

      console.log('📤 Sending message to', options?.body?.model || selectedModel)

      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: options?.body?.conversationId || effectiveConversationId,
          model: options?.body?.model || selectedModel,
          agentId: options?.body?.agentId,
          messages: aiMessages,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      setStatus('streaming')

      // Manual stream parsing without schema validation (to support custom data parts)
      await consumeStream({
        stream: response.body!
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                const lines = chunk.split('\n')
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6))
                      controller.enqueue(data)
                    } catch (e) {
                      // Skip unparseable lines
                    }
                  }
                }
              },
            })
          )
          .pipeThrough(
            new TransformStream({
              async transform(part) {
                const streamPart = part  // No schema validation

                // Reduced logging - only log non-delta events
                if (!streamPart.type.includes('delta')) {
                  console.log('📦 Stream part:', streamPart.type)
                }

              // Handle text deltas
              if (streamPart.type === 'text-delta') {
                const deltaText = streamPart.delta  // AI SDK v5 uses "delta", not "textDelta"
                // Safety check: only append if delta is a valid string
                if (typeof deltaText !== 'string') {
                  console.warn('⚠️ Invalid text-delta:', streamPart)
                  return
                }

                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === assistantMessageId) {
                      const newContent = m.content + deltaText
                      return {
                        ...m,
                        content: newContent,
                        parts: [{ type: 'text', text: newContent }], // Keep parts in sync with content
                      }
                    }
                    return m
                  })
                )
              }

              // Handle artifact metadata (create artifact and auto-open panel)
              if (streamPart.type === 'data-artifact-metadata') {
                const { id, data } = streamPart as any
                console.log('📝 Artifact metadata:', data.title)

                setArtifacts((prev) => {
                  const now = Date.now()

                  // Map backend 'kind' to frontend 'type'
                  let artifactType = data.kind || 'document'
                  if (artifactType === 'text') {
                    artifactType = 'markdown'  // Convert 'text' to 'markdown' for proper rendering
                  }

                  const newArtifact: Artifact = {
                    id,
                    title: data.title || 'Untitled',
                    type: artifactType,
                    content: '',
                    language: data.language,
                    createdAt: now,
                    updatedAt: now,
                    // Store messageId for editing
                    metadata: { messageId: assistantMessageId },
                  }
                  const newIndex = prev.length

                  // Auto-open panel when artifact is created
                  setIsPanelOpen(true)
                  setCurrentArtifactIndex(newIndex)

                  return [...prev, newArtifact]
                })
              }

              // Handle artifact delta (full content sent each time, not incremental)
              if (streamPart.type === 'data-artifact-delta') {
                const { id, data } = streamPart as any
                // Silent - too verbose to log every delta

                setArtifacts((prev) =>
                  prev.map((artifact) =>
                    artifact.id === id
                      ? { ...artifact, content: data, updatedAt: Date.now() }
                      : artifact
                  )
                )
              }

              // Handle artifact complete
              if (streamPart.type === 'data-artifact-complete') {
                const { id, data } = streamPart as any
                console.log('✅ Artifact complete:', data.title)

                setArtifacts((prev) =>
                  prev.map((artifact) => {
                    if (artifact.id === id) {
                      // Map backend 'kind' to frontend 'type'
                      let finalType = data.kind || artifact.type
                      if (finalType === 'text') {
                        finalType = 'markdown'
                      }

                      return {
                        ...artifact,
                        title: data.title || artifact.title,
                        content: data.content || artifact.content,
                        type: finalType,
                        language: data.language || artifact.language,
                        updatedAt: Date.now(),
                      }
                    }
                    return artifact
                  })
                )
              }
            },
          })
        ),
        onError: (streamError) => {
          console.error('❌ Stream error:', streamError)
          throw streamError
        },
      })

      setStatus('idle')

      // Refresh sidebar conversation list
      invalidateConversations()

      // Update URL with conversationId (without navigation/remount)
      if (!hasNavigatedRef.current && !urlConversationId) {
        hasNavigatedRef.current = true
        console.log('🔗 First message - updating URL with conversationId:', effectiveConversationId)
        navigate({
          to: '/ai-chat',
          search: { conversationId: effectiveConversationId, agentId },
          replace: true,
        })
      }
    } catch (err) {
      console.error('❌ Chat error:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
      setStatus('error')
    }
  }

  const isLoading = status === 'submitted' || status === 'streaming'

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
                      onClick={() => {
                        // Pass conversationId, model, and agentId dynamically (AI SDK v5 pattern)
                        sendMessage(
                          { text: prompt },
                          {
                            body: {
                              conversationId: effectiveConversationId,
                              model: selectedModel,
                              agentId: agentId,
                            },
                          }
                        )
                      }}
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
              {messages.map((message) => {
                // Debug: log message structure if it has issues
                const hasUndefinedText = message.parts?.some(part => part.type === 'text' && part.text === undefined)
                if (hasUndefinedText) {
                  console.warn('⚠️ Message has undefined text in parts:', message)
                }

                return (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <MessageResponse>
                        {message.parts?.map((part) => part.type === 'text' ? (part.text ?? '') : '').join('') || message.content}
                      </MessageResponse>
                    </MessageContent>
                  </Message>
                )
              })}

              {/* Thinking indicator - show when AI is processing */}
              {isLoading && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
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
          onSubmit={(message, event) => {
            if (message.text?.trim()) {
              // Pass conversationId, model, and agentId dynamically at request time (AI SDK v5 pattern)
              sendMessage(
                { text: message.text },
                {
                  body: {
                    conversationId: effectiveConversationId, // Dynamic value at request time
                    model: selectedModel, // Dynamic value at request time
                    agentId: agentId, // Selected agent ID from URL
                  },
                }
              )
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Send a message..."
              disabled={isLoading}
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
