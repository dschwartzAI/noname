import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conversation } from '../types'

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const displayTitle = conversation.title || conversation.lastMessage?.content.substring(0, 40) || 'New conversation'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors',
        isSelected && 'bg-accent'
      )}
    >
      {/* Agent Icon */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={conversation.agent.avatar} />
        <AvatarFallback className="text-xs">
          {conversation.agent.name[0]}
        </AvatarFallback>
      </Avatar>

      {/* Title & Preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayTitle}</p>
        {conversation.lastMessage && (
          <p className="text-xs text-muted-foreground truncate">
            {conversation.lastMessage.content.substring(0, 40)}...
          </p>
        )}
      </div>

      {/* Actions (show on hover) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          // TODO: Show dropdown menu
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  )
}
