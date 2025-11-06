import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { observer, useAIChatMobx } from '@/stores'

export const Route = createFileRoute('/_authenticated/ai-chat-legend-test')({
  component: AIChatTestPage,
})

const AIChatTestPage = observer(() => {
  const chat = useAIChatMobx()

  return (
    <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>MobX AI Chat Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>isStreaming: {String(chat.isStreaming)}</p>
            <p>input: {chat.input}</p>
            <p>messageCount: {chat.messageCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})