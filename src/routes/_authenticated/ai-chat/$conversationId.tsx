import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { PaperclipIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useInvalidateConversations } from '@/hooks/use-conversations'
import { getAgentIconSrc, getAgentEmoji } from '@/features/ai-chat/utils/get-agent-icon'
import { nanoid } from 'nanoid'
import {
  Conversation,
  ConversationContent,
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
import { parseArtifactsFromContent } from '@/utils/artifact-parser'
import { ArtifactMessageComponent } from '@/components/artifacts/artifact-message'
import { ArtifactSidePanel } from '@/components/artifacts/artifact-side-panel'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { Artifact } from '@/types/artifacts'

// Available AI models
const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { value: 'grok-2-latest', label: 'Grok 2', provider: 'xAI' },
]

interface ConversationData {
  conversation: {
    id: string
    title: string
    model: string
    toolId: string | null
    createdAt: string
    updatedAt: string
  }
  messages: Array<{
    id: string
    role: string
    content: string
    createdAt: string
  }>
}

/**
 * Fetch conversation with message history from backend
 */
async function fetchConversation(conversationId: string): Promise<ConversationData> {
  const response = await fetch(`/api/v1/chat/${conversationId}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch conversation')
  }

  return response.json()
}

function ConversationPage() {
  const { conversationId } = Route.useParams()
  const invalidateConversations = useInvalidateConversations()

  // Fetch conversation data from API
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => fetchConversation(conversationId),
    retry: 1,
  })

  // Fetch agent details if conversation has a toolId
  const { data: agentData } = useQuery({
    queryKey: ['agent', data?.conversation.toolId],
    queryFn: async () => {
      if (!data?.conversation.toolId) return null
      const response = await fetch(`/api/v1/agents/${data.conversation.toolId}`)
      if (!response.ok) return null
      const agentResponse = await response.json()
      return agentResponse.agent
    },
    enabled: !!data?.conversation.toolId,
  })

  // Get model from conversation data, with fallback
  const [selectedModel, setSelectedModel] = useState(data?.conversation.model || 'gpt-4o')

  // Wait for data to load before rendering chat
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header skeleton */}
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-16 w-2/3 ml-auto" />
          <Skeleton className="h-16 w-3/4" />
        </div>
      </div>
    )
  }

  // Error state
  if (fetchError || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Conversation not found</h2>
          <p className="text-muted-foreground">
            {fetchError instanceof Error ? fetchError.message : "The conversation you're looking for doesn't exist."}
          </p>
        </div>
      </div>
    )
  }

  return <ConversationChat
    conversationId={conversationId}
    data={data}
    agentData={agentData}
    selectedModel={selectedModel}
    setSelectedModel={setSelectedModel}
    invalidateConversations={invalidateConversations}
  />
}

function ConversationChat({
  conversationId,
  data,
  agentData,
  selectedModel,
  setSelectedModel,
  invalidateConversations
}: {
  conversationId: string
  data: ConversationData
  agentData: any
  selectedModel: string
  setSelectedModel: (model: string) => void
  invalidateConversations: () => void
}) {
  // Convert API messages to UIMessage format (AI SDK v5)
  const initialMessages = data.messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    parts: [
      {
        type: 'text',
        text: msg.content,
      }
    ],
    status: 'ready' as const,
  }))

  const queryClient = useQueryClient()
  const prevConversationIdRef = useRef<string | null>(null)

  // Artifact side panel state
  const [selectedArtifactIndex, setSelectedArtifactIndex] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const hasAutoOpenedRef = useRef(false)


  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Artifact streaming state (managed via custom data stream parts)
  const [streamingArtifact, setStreamingArtifact] = useState<{
    id: string
    title: string
    kind: 'text' | 'code' | 'html' | 'react'
    content: string
    language?: string
  } | null>(null)

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: conversationId, // Pass conversationId for persistence
    api: '/api/v1/chat',
    messages: initialMessages, // Load existing messages from database (explicit prop name)
    experimental_throttle: 100, // Match Vercel AI Chatbot

    // Handle custom data stream parts for artifact streaming
    experimental_onData: (data) => {
      console.log('📡 Received data part:', data)

      // Artifact metadata - signals new artifact creation
      if (data.type === 'artifact-metadata') {
        const { id, title, kind } = data.data as { id: string; title: string; kind: 'text' | 'code' | 'html' | 'react' }
        console.log('🎨 Artifact metadata received:', { id, title, kind })
        setStreamingArtifact({
          id,
          title,
          kind,
          content: '',
          language: kind === 'code' ? 'javascript' : undefined,
        })
      }

      // Artifact content delta - progressive content updates
      if (data.type === 'artifact-delta') {
        const contentDelta = data.data as string
        setStreamingArtifact((prev) => {
          if (!prev) return null
          return {
            ...prev,
            content: contentDelta, // Replace with latest content
          }
        })
      }

      // Artifact complete - final artifact received
      if (data.type === 'artifact-complete') {
        const finalArtifact = data.data as {
          title: string
          kind: 'text' | 'code' | 'html' | 'react'
          content: string
          language?: string
        }
        console.log('✅ Artifact complete:', finalArtifact)
        setStreamingArtifact({
          id: streamingArtifact?.id || nanoid(),
          ...finalArtifact,
        })
      }
    },

    onFinish: async () => {
      // Clear streaming artifact when response finishes
      if (streamingArtifact) {
        console.log('🏁 Clearing streaming artifact')
        setStreamingArtifact(null)
      }

      // Refresh sidebar conversation list
      invalidateConversations()
      // Also refresh THIS conversation's data so cache stays fresh
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error) => {
      console.error('❌ Chat error:', error)
      setStreamingArtifact(null)
    },
  })

  // Sync server messages with client state when navigating to a different conversation
  // AI SDK v5 pattern: setMessages updates state without remounting component
  useEffect(() => {
    // Only sync when conversationId changes (navigating between conversations)
    if (prevConversationIdRef.current !== conversationId) {
      // Convert API messages to UIMessage format
      const syncedMessages = data.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [
          {
            type: 'text',
            text: msg.content,
          }
        ],
        status: 'ready' as const,
      }))

      setMessages(syncedMessages)
      prevConversationIdRef.current = conversationId
    }
  }, [conversationId, data.messages, setMessages])

  // Parse artifacts from messages (both code blocks and tool calls)
  const messageArtifacts = useMemo(() => {
    const artifactsByMessage = new Map<string, Artifact[]>()
    const isStreaming = status === 'streaming'

    messages.forEach((message, index) => {
      if (!agentData?.artifactsEnabled) return

      const artifacts: Artifact[] = []

      // 1. Check for createDocument tool calls
      message.parts?.forEach((part) => {
        if (part.type === 'tool-call' && part.toolName === 'createDocument') {
          console.log('🔧 Detected createDocument tool call:', part)
          // Extract parameters from tool call
          const { title, kind, content } = part.args as { title: string; kind: string; content: string }
          artifacts.push({
            id: part.toolCallId,
            title,
            type: kind === 'text' ? 'markdown' : 'code',
            content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as Artifact)
        }
      })

      // 2. Fallback: Parse code blocks (for backwards compatibility)
      const textContent = message.parts?.map((part) =>
        part.type === 'text' ? part.text : ''
      ).join('') || ''

      if (textContent && artifacts.length === 0) {
        const isLastMessage = index === messages.length - 1
        const allowPartial = isStreaming && isLastMessage && message.role === 'assistant'
        const parsedArtifacts = parseArtifactsFromContent(textContent, message.id, allowPartial)
        artifacts.push(...parsedArtifacts)
      }

      if (artifacts.length > 0) {
        artifactsByMessage.set(message.id, artifacts)
      }
    })

    return artifactsByMessage
  }, [messages, agentData?.artifactsEnabled, status])

  // Collect all artifacts from the cached parse results + streaming artifact
  const allArtifacts = useMemo(() => {
    const artifacts: Artifact[] = []
    messageArtifacts.forEach((messageArtifacts) => {
      artifacts.push(...messageArtifacts)
    })

    // Add streaming artifact if it exists (progressive updates)
    if (streamingArtifact && (streamingArtifact.title || streamingArtifact.content)) {
      const kindMap: Record<string, Artifact['type']> = {
        'text': 'markdown',
        'code': 'code',
        'html': 'html',
        'react': 'react-component',
      }

      artifacts.push({
        id: artifactIdRef.current || 'streaming-artifact',
        title: streamingArtifact.title || 'Generating...',
        type: kindMap[streamingArtifact.kind || 'text'] || 'markdown',
        content: streamingArtifact.content || '',
        language: streamingArtifact.language,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Artifact)
    }

    return artifacts
  }, [messageArtifacts, streamingArtifact])

  // Auto-open side panel when artifact streaming starts
  useEffect(() => {
    // Open panel when streamObject starts populating (progressive streaming)
    if (streamingArtifact && (streamingArtifact.title || streamingArtifact.content)) {
      if (selectedArtifactIndex === null) {
        setSelectedArtifactIndex(allArtifacts.length - 1) // Open the streaming artifact (last in array)
        console.log('🎬 Auto-opened side panel for streaming artifact')
      }
      return
    }

    // Fallback: Auto-open for completed artifacts (backwards compatibility)
    if (hasAutoOpenedRef.current) return

    // Check last assistant message for tool calls or code blocks
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        // Check for createDocument tool call
        const hasToolCall = lastMessage.parts?.some(part =>
          part.type === 'tool-call' && part.toolName === 'createDocument'
        )

        if (hasToolCall && selectedArtifactIndex === null) {
          setSelectedArtifactIndex(0)
          hasAutoOpenedRef.current = true
          console.log('🎬 Auto-opened side panel for tool-based artifact')
          return
        }

        // Fallback: Check for code blocks (backwards compatibility)
        const textContent = lastMessage.parts?.map((part) =>
          part.type === 'text' ? part.text : ''
        ).join('') || ''

        const hasOpeningFence = /```(?:markdown|document|code|javascript|typescript|html|css)/i.test(textContent)

        if (hasOpeningFence && selectedArtifactIndex === null) {
          setSelectedArtifactIndex(0)
          hasAutoOpenedRef.current = true
          console.log('🎬 Auto-opened side panel for code block artifact')
        }
      }
    }

    // Also open when complete artifacts appear (general fallback)
    if (!hasAutoOpenedRef.current && allArtifacts.length > 0 && selectedArtifactIndex === null) {
      setSelectedArtifactIndex(0)
      hasAutoOpenedRef.current = true
      console.log('🎬 Auto-opened side panel for completed artifact')
    }
  }, [streamingArtifact, messages, allArtifacts.length, selectedArtifactIndex])

  // Reset auto-open flag when navigating to different conversation
  useEffect(() => {
    hasAutoOpenedRef.current = false
  }, [conversationId])

  // Keyboard shortcuts (ESC to close, Cmd+\ to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close
      if (e.key === 'Escape' && selectedArtifactIndex !== null) {
        setSelectedArtifactIndex(null)
      }
      // Cmd+\ to toggle (open first artifact or close)
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        if (selectedArtifactIndex !== null) {
          setSelectedArtifactIndex(null)
        } else if (allArtifacts.length > 0) {
          setSelectedArtifactIndex(0)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedArtifactIndex, allArtifacts.length])

  const isChatLoading = status === 'submitted' || status === 'streaming'

  // Main chat content
  const chatContent = (
    <div className="flex flex-col h-full">
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
            <h2 className="font-semibold">{data.conversation.title || 'Conversation'}</h2>
            <p className="text-xs text-muted-foreground">
              {agentData?.description || data.conversation.model}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation Area with Auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => {
            // Extract text content from message parts
            const textContent = message.parts?.map((part) =>
              part.type === 'text' ? part.text : ''
            ).join('') || ''

            // Use cached artifacts (already parsed)
            const artifacts = messageArtifacts.get(message.id) || []

            // Create artifact message format with selection handler
            const artifactMessage = {
              id: message.id,
              role: message.role,
              content: textContent,
              artifacts: artifacts,
            }

            return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <ArtifactMessageComponent
                    message={artifactMessage}
                    onArtifactSelect={(artifactId) => {
                      const index = allArtifacts.findIndex(a => a.id === artifactId)
                      if (index !== -1) {
                        // Toggle: if clicking already-selected artifact, close it
                        if (selectedArtifactIndex === index) {
                          setSelectedArtifactIndex(null)
                        } else {
                          setSelectedArtifactIndex(index)
                        }
                      }
                    }}
                    selectedArtifactId={selectedArtifactIndex !== null ? allArtifacts[selectedArtifactIndex]?.id : undefined}
                  />
                </MessageContent>
              </Message>
            )
          })}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              Error: {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput
          onSubmit={(message, event) => {
            if (message.text?.trim()) {
              // Send message - artifact tool will be called automatically if agent has artifacts enabled
              sendMessage(
                { text: message.text },
                {
                  body: {
                    conversationId, // Dynamic value at request time
                    model: selectedModel, // Dynamic value at request time
                    agentId: data.conversation.toolId, // Pass agent/tool ID from conversation
                  },
                }
              )
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Send a message..."
              disabled={isChatLoading}
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
  )

  // Desktop: Resizable side panel | Mobile: Full-screen dialog
  if (selectedArtifactIndex !== null && allArtifacts.length > 0) {
    if (isMobile) {
      // Mobile: Full-screen dialog
      return (
        <>
          {chatContent}
          <Dialog open={true} onOpenChange={(open) => !open && setSelectedArtifactIndex(null)}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 gap-0">
              <ArtifactSidePanel
                artifacts={allArtifacts}
                currentIndex={selectedArtifactIndex}
                onIndexChange={setSelectedArtifactIndex}
                onClose={() => setSelectedArtifactIndex(null)}
              />
            </DialogContent>
          </Dialog>
        </>
      )
    } else {
      // Desktop: Resizable split screen
      return (
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={55} minSize={30}>
            {chatContent}
          </Panel>
          <PanelResizeHandle className="w-px bg-border hover:bg-primary transition-colors" />
          <Panel defaultSize={45} minSize={30}>
            <ArtifactSidePanel
              artifacts={allArtifacts}
              currentIndex={selectedArtifactIndex}
              onIndexChange={setSelectedArtifactIndex}
              onClose={() => setSelectedArtifactIndex(null)}
            />
          </Panel>
        </PanelGroup>
      )
    }
  }

  // No artifact selected: show just chat
  return chatContent
}

export const Route = createFileRoute('/_authenticated/ai-chat/$conversationId')({
  component: ConversationPage,
})
