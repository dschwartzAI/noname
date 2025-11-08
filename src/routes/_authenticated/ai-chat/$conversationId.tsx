import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { useEffect, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { PaperclipIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useInvalidateConversations } from '@/hooks/use-conversations'
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
    selectedModel={selectedModel}
    setSelectedModel={setSelectedModel}
    invalidateConversations={invalidateConversations}
  />
}

function ConversationChat({
  conversationId,
  data,
  selectedModel,
  setSelectedModel,
  invalidateConversations
}: {
  conversationId: string
  data: ConversationData
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

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: conversationId, // Pass conversationId for persistence
    api: '/api/v1/chat',
    messages: initialMessages, // Load existing messages from database (explicit prop name)
    experimental_throttle: 100, // Match Vercel AI Chatbot
    onFinish: async () => {
      // Refresh sidebar conversation list
      invalidateConversations()
      // Also refresh THIS conversation's data so cache stays fresh
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error) => {
      console.error('❌ Chat error:', error)
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

  const isChatLoading = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{data.conversation.title || 'Conversation'}</h2>
            <p className="text-xs text-muted-foreground">
              {data.conversation.model}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation Area with Auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                <MessageResponse>
                  {message.parts?.map((part) => part.type === 'text' ? part.text : '').join('') || message.content}
                </MessageResponse>
              </MessageContent>
            </Message>
          ))}

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
              // Pass conversationId and model dynamically at request time (AI SDK v5 pattern)
              sendMessage(
                { text: message.text },
                {
                  body: {
                    conversationId, // Dynamic value at request time
                    model: selectedModel, // Dynamic value at request time
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

              <PromptInputSelect value={selectedModel} onValueChange={setSelectedModel}>
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
              </PromptInputSelect>
            </PromptInputTools>

            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat/$conversationId')({
  component: ConversationPage,
})
