"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ThumbsUp, MessageSquare, MoreVertical, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { SelectBoardReply } from '@/database/schema/message-board'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ReplyCardProps {
  reply: SelectBoardReply & {
    author: {
      name: string
      email: string
      image?: string
    }
    nestedReplies?: any[]
    isLiked?: boolean
  }
  onLike: () => void
  onReply: () => void
  onEdit?: () => void
  onDelete?: () => void
  isNested?: boolean
  canModerate?: boolean
}

export function ReplyCard({
  reply,
  onLike,
  onReply,
  onEdit,
  onDelete,
  isNested = false,
  canModerate = false
}: ReplyCardProps) {
  return (
    <Card className={cn(isNested && "ml-12")}>
      <CardContent className="py-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={reply.author.image} />
            <AvatarFallback>
              {reply.author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="font-semibold">{reply.author.name}</span>
              {reply.markedAsSolution && (
                <Badge className="bg-green-600 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Solution
                </Badge>
              )}
              {reply.edited && (
                <Badge variant="secondary" className="text-xs">
                  Edited
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
              </span>
              
              {/* More menu */}
              {(canModerate || onEdit) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem onClick={onEdit}>
                        Edit Reply
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem 
                        onClick={onDelete}
                        className="text-destructive"
                      >
                        Delete Reply
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Reply content */}
            <p className="text-sm whitespace-pre-wrap">{reply.content}</p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLike}
                className={cn(
                  "gap-1",
                  reply.isLiked && "text-blue-600"
                )}
              >
                <ThumbsUp className={cn("h-4 w-4", reply.isLiked && "fill-current")} />
                {reply.likeCount > 0 && reply.likeCount}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className="gap-1"
              >
                <MessageSquare className="h-4 w-4" />
                Reply
              </Button>
            </div>

            {/* Nested replies */}
            {reply.nestedReplies && reply.nestedReplies.length > 0 && (
              <div className="space-y-2 mt-4">
                {reply.nestedReplies.map((nestedReply: any) => (
                  <ReplyCard
                    key={nestedReply.id}
                    reply={nestedReply}
                    onLike={() => {}}
                    onReply={() => {}}
                    isNested
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

