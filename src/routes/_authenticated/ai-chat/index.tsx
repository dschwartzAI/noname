import { createFileRoute } from '@tanstack/react-router'
import { useChat, type Message } from '@ai-sdk/react'
import { useEffect, useRef, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Bot, User } from 'lucide-react'

function ChatPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  // Stabilize initial messages to prevent re-renders from resetting conversation
  const initialMessages = useMemo<Message[]>(
    () => [
      {
        id: 'greeting-1',
        role: 'assistant',
        content: 'Hello there! How can I help you today?',
      },
    ],
    []
  )

  const { messages, sendMessage, status, error } = useChat({
    api: '/api/v1/chat',
    body: {
      model: 'gpt-4o',
    },
    initialMessages,
    onResponse: (response) => {
      console.log('✅ Response received:', response.status, response.statusText)
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))
      console.log('📦 Response body type:', response.body?.constructor.name)
    },
    onFinish: (message) => {
      console.log('🎉 Message finished:', message)
      console.log('📝 Current messages array:', messages)
    },
    onError: (error) => {
      console.error('❌ Chat error:', error)
      console.error('❌ Error details:', error.message, error.cause)
    },
    experimental_onChunk: (chunk) => {
      console.log('📨 Chunk received:', chunk)
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Log when messages change
  useEffect(() => {
    console.log('💬 Messages updated:', messages.length, messages)
    if (messages.length > 0) {
      console.log('🔍 First message details:', {
        id: messages[0].id,
        role: messages[0].role,
        content: messages[0].content,
        parts: messages[0].parts,
        allKeys: Object.keys(messages[0])
      })
    }
  }, [messages])

  // Log loading state changes
  useEffect(() => {
    console.log('⏳ Loading state:', isLoading)
  }, [isLoading])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
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
            {message.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
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
            placeholder="Message SovereignJK"
            className="min-h-[60px] max-h-32 resize-none"
            rows={1}
            disabled={isLoading}
          />

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

export const Route = createFileRoute('/_authenticated/ai-chat/')({
  component: ChatPage,
})
