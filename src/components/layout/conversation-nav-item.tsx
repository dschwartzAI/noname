import { Link, useNavigate } from '@tanstack/react-router'
import { MoreVertical, Trash2, Edit3 } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useInvalidateConversations } from '@/hooks/use-conversations'
import type { Conversation } from '@/features/ai-chat/types'
import { cn } from '@/lib/utils'

interface ConversationNavItemProps {
  conversation: Conversation
  isActive: boolean
}

export function ConversationNavItem({ conversation, isActive }: ConversationNavItemProps) {
  const { state } = useSidebar()
  const navigate = useNavigate()
  const invalidateConversations = useInvalidateConversations()

  const displayTitle =
    conversation.title || conversation.lastMessage?.content.substring(0, 40) || 'New conversation'

  // State for dialogs
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(displayTitle)

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const response = await fetch(`/api/v1/chat/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle }),
      })
      if (!response.ok) throw new Error('Failed to rename conversation')
      return response.json()
    },
    onSuccess: () => {
      invalidateConversations()
      setIsRenameOpen(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/chat/${conversation.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to delete conversation')
      return response.json()
    },
    onSuccess: () => {
      invalidateConversations()
      setIsDeleteOpen(false)
      // Navigate to chat index if we deleted the active conversation
      if (isActive) {
        navigate({ to: '/ai-chat' })
      }
    },
  })

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== displayTitle) {
      renameMutation.mutate(renameValue.trim())
    }
  }

  const handleDelete = () => {
    deleteMutation.mutate()
  }

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
              <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="conversation-title">Conversation Title</Label>
            <Input
              id="conversation-title"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                }
              }}
              placeholder="Enter conversation title"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameOpen(false)}
              disabled={renameMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameMutation.isPending || !renameValue.trim()}
            >
              {renameMutation.isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{displayTitle}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}
