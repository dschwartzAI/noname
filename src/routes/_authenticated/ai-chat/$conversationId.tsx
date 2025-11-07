import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState, useMemo } from 'react'
import { AgentHeader } from '@/features/ai-chat/components/agent-header'
import { mockConversations } from '@/features/ai-chat/data/mock-conversations'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Paperclip, Send, Mic, Loader2 } from 'lucide-react'

function ConversationPage() {
  const { conversationId } = Route.useParams()
  const conversation = mockConversations.find((c) => c.id === conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  // Stabilize initial messages
  const initialMessages = useMemo(
    () => [
      {
        id: '1',
        role: 'assistant' as const,
        content: conversation?.agent.greeting || 'How can I help you today?',
      },
    ],
    [conversation?.agent.greeting]
  )

  const { messages, sendMessage, status, error } = useChat({
    api: '/api/chat',
    body: {
      model: conversation?.agent.model || 'gpt-4o',
    },
    initialMessages,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Conversation not found</h2>
          <p className="text-muted-foreground">The conversation you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent Header */}
      <AgentHeader agent={conversation.agent} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">
                {message.parts?.map((part) => part.type === 'text' ? part.text : '').join('') || message.content}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex gap-4 justify-center">
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-destructive/10 text-destructive">
              <p className="text-sm">Error: {error.message}</p>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) {
              sendMessage({ text: input })
              setInput('')
            }
          }}
          className="flex items-end gap-2"
        >
          <Button type="button" variant="ghost" size="icon" className="flex-shrink-0">
            <Paperclip className="h-5 w-5" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (input.trim()) {
                  sendMessage({ text: input })
                  setInput('')
                }
              }
            }}
            placeholder={`Message ${conversation.agent.name}`}
            className="min-h-[60px] max-h-32 resize-none"
            rows={1}
            disabled={isLoading}
          />

          <Button type="button" variant="ghost" size="icon" className="flex-shrink-0">
            <Mic className="h-5 w-5" />
          </Button>

          <Button
            type="submit"
            size="icon"
            className="flex-shrink-0"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat/$conversationId')({
  component: ConversationPage,
})
