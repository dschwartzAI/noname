import { createFileRoute } from '@tanstack/react-router'
import { Bot, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { defaultAgent } from '@/features/ai-chat/data/mock-conversations'

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-6 max-w-md px-8">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Welcome to Solo:OS AI Chat</h2>
          <p className="text-muted-foreground">
            Select a conversation from the sidebar or start a new chat to begin
          </p>
        </div>

        <div className="grid gap-4 pt-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-left">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Continue a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Pick up where you left off with any of your previous chats
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-left">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Start fresh</h3>
              <p className="text-sm text-muted-foreground">
                Click "New Chat" to begin a new conversation with {defaultAgent.name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat/')({
  component: EmptyState,
})
