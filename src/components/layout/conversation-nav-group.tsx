import { useState } from 'react'
import { Plus, ChevronRight, History } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ConversationNavItem } from './conversation-nav-item'
import { groupConversationsByTime } from '@/features/ai-chat/utils/time-grouping'
import type { Conversation } from '@/features/ai-chat/types'
import { ToolSelector } from './tool-selector'
import { Button } from '@/components/ui/button'

interface ConversationNavGroupProps {
  conversations: Conversation[]
  activeConversationId?: string
}

export function ConversationNavGroup({
  conversations,
  activeConversationId,
}: ConversationNavGroupProps) {
  const { state, open, setOpen } = useSidebar()
  const grouped = groupConversationsByTime(conversations)

  // Determine default open state for each time group
  const defaultOpenGroups = ['Today', 'Yesterday']
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.keys(grouped).reduce(
      (acc, group) => ({
        ...acc,
        [group]: defaultOpenGroups.includes(group),
      }),
      {}
    )
  )

  // When collapsed, show just the History button that opens the sidebar
  if (state === 'collapsed') {
    return (
      <SidebarGroup>
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setOpen(true)}
          title="Open History"
        >
          <History className="h-4 w-4" />
          <span className="sr-only">Open History</span>
        </Button>
      </SidebarGroup>
    )
  }

  if (conversations.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>
          <History className="h-4 w-4 mr-2" />
          History
          <ToolSelector
            trigger={
              <SidebarGroupAction title="New Chat">
                <Plus className="h-4 w-4" />
                <span className="sr-only">New Chat</span>
              </SidebarGroupAction>
            }
          />
        </SidebarGroupLabel>
        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
          No conversations yet
        </div>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <History className="h-4 w-4 mr-2" />
        History
        <ToolSelector
          trigger={
            <SidebarGroupAction title="New Chat">
              <Plus className="h-4 w-4" />
              <span className="sr-only">New Chat</span>
            </SidebarGroupAction>
          }
        />
      </SidebarGroupLabel>

      <SidebarMenu>
        {Object.entries(grouped).map(([timeGroup, convos]) => (
          <Collapsible
            key={timeGroup}
            open={openGroups[timeGroup]}
            onOpenChange={(open) =>
              setOpenGroups((prev) => ({ ...prev, [timeGroup]: open }))
            }
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="text-xs font-semibold text-muted-foreground">
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${
                      openGroups[timeGroup] ? 'rotate-90' : ''
                    }`}
                  />
                  <span>{timeGroup}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {convos.map((convo) => (
                    <ConversationNavItem
                      key={convo.id}
                      conversation={convo}
                      isActive={convo.id === activeConversationId}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
