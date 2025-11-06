import { Link } from '@tanstack/react-router'
import { MoreVertical, Trash2, Edit3 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import type { Conversation } from '@/features/ai-chat/types'
import { cn } from '@/lib/utils'

interface ConversationNavItemProps {
  conversation: Conversation
  isActive: boolean
}

export function ConversationNavItem({ conversation, isActive }: ConversationNavItemProps) {
  const { state } = useSidebar()
  const displayTitle =
    conversation.title || conversation.lastMessage?.content.substring(0, 40) || 'New conversation'

  return (
    <SidebarMenuItem>
      <div className="group/item flex items-center gap-2 w-full">
        <SidebarMenuButton asChild isActive={isActive} className="flex-1">
          <Link
            to="/ai-chat/$conversationId"
            params={{ conversationId: conversation.id }}
            className="flex items-center gap-2"
          >
            {/* Agent Avatar */}
            {state === 'expanded' && (
              <Avatar className="h-5 w-5 flex-shrink-0">
                <AvatarImage src={conversation.agent.avatar} />
                <AvatarFallback className="text-[10px]">
                  {conversation.agent.name[0]}
                </AvatarFallback>
              </Avatar>
            )}

            {/* Title */}
            <span className="truncate text-sm">{displayTitle}</span>
          </Link>
        </SidebarMenuButton>

        {/* Actions (visible on hover in expanded mode) */}
        {state === 'expanded' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </SidebarMenuItem>
  )
}
