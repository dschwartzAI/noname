import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect } from 'react'
import { Bot } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useInvalidateConversations } from '@/hooks/use-conversations'
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
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const invalidateConversations = useInvalidateConversations()

  // Generate conversation ID upfront (like Vercel AI Chatbot pattern)
  const [conversationId] = useState(() => nanoid())

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId, // Pass ID to useChat (Vercel pattern)
    api: '/api/v1/chat',
    onFinish: async () => {
      // Refresh sidebar conversation list to show new conversation with generated title
      invalidateConversations()
    },
    onError: (error) => {
      console.error('❌ Chat error:', error)
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">SovereignJK</h2>
            <p className="text-xs text-muted-foreground">How can I help?</p>
          </div>
        </div>
      </div>

      {/* Conversation Area with Auto-scroll */}
      <Conversation className="flex-1">
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
                        // Pass conversationId and model dynamically (AI SDK v5 pattern)
                        sendMessage(
                          { text: prompt },
                          {
                            body: {
                              conversationId,
                              model: selectedModel,
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
              disabled={isLoading}
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

export const Route = createFileRoute('/_authenticated/ai-chat/')({
  component: ChatPage,
})
