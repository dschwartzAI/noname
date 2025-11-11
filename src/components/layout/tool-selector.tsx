/**
 * ToolSelector Component - Agent/Tool selection for new chats
 *
 * Shows a popover with available tools when user clicks "New Chat"
 * Allows selecting which agent/tool to use for the conversation
 */

import { useState } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useAgents } from '@/hooks/use-agents'
import { Skeleton } from '@/components/ui/skeleton'
import { nanoid } from 'nanoid'
import { getAgentIconSrc, getAgentEmoji } from '@/features/ai-chat/utils/get-agent-icon'

interface ToolSelectorProps {
  /** Custom trigger element (optional) */
  trigger?: React.ReactNode
  /** Callback after tool is selected */
  onSelect?: (agentId: string) => void
}

export function ToolSelector({ trigger, onSelect }: ToolSelectorProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data, isLoading, error } = useAgents()

  const handleToolSelect = (agentId: string) => {
    // Close popover
    setOpen(false)

    // Trigger callback if provided
    onSelect?.(agentId)

    // Navigate to chat with new conversation ID and agent ID
    const conversationId = nanoid()
    navigate({
      to: '/ai-chat',
      search: {
        new: Date.now().toString(),
        conversationId,
        agentId,
      },
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" title="New Chat">
            <Plus className="h-4 w-4" />
            <span className="sr-only">New Chat</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Select a Tool</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose an AI assistant for your conversation
          </p>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="p-3 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-sm text-destructive">
              Failed to load tools
            </div>
          )}

          {data && data.agents.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tools available. Contact your organization owner to create tools.
            </div>
          )}

          {data && data.agents.length > 0 && (
            <div className="py-2">
              {data.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleToolSelect(agent.id)}
                  className="w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left flex items-center gap-3"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {getAgentIconSrc(agent) ? (
                      <img
                        src={getAgentIconSrc(agent)!}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">{getAgentEmoji(agent) || '🤖'}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    {agent.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {agent.description}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
