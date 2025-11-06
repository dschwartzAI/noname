import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ConversationItem } from './conversation-item'
import { groupConversationsByTime } from '../utils/time-grouping'
import type { Conversation } from '../types'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (id: string) => void
  onNewChat: () => void
}

export function ConversationList({ conversations, selectedId, onSelect, onNewChat }: ConversationListProps) {
  const grouped = groupConversationsByTime(conversations)

  return (
    <div className="flex flex-col h-full bg-muted/40">
      {/* New Chat Button */}
      <div className="p-3 border-b">
        <Button onClick={onNewChat} className="w-full justify-start" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {Object.entries(grouped).map(([timeGroup, convos]) => (
            <div key={timeGroup} className="mb-4">
              <h3 className="px-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                {timeGroup}
              </h3>
              <div className="space-y-0.5">
                {convos.map((convo) => (
                  <ConversationItem
                    key={convo.id}
                    conversation={convo}
                    isSelected={convo.id === selectedId}
                    onClick={() => onSelect(convo.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No conversations yet. Start a new chat!
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
