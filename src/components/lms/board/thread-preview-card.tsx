"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, ThumbsUp, Eye, Pin, Lock, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { SelectBoardThread } from '@/database/schema/message-board'

interface ThreadPreviewCardProps {
  thread: SelectBoardThread & {
    author: {
      name: string
      email: string
      image?: string
    }
    category?: {
      name: string
      icon?: string
      color?: string
    }
  }
  onClick: () => void
}

export function ThreadPreviewCard({ thread, onClick }: ThreadPreviewCardProps) {
  return (
    <Card 
      className="hover:bg-accent transition-colors cursor-pointer" 
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Icons */}
          <div className="flex flex-col gap-1">
            {thread.pinned && (
              <Pin className="h-5 w-5 text-yellow-600" />
            )}
            {thread.locked && (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
            {thread.solved && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <CardTitle className="text-base line-clamp-2">
              {thread.title}
            </CardTitle>
            
            {/* Preview */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {thread.content}
            </p>

            {/* Tags */}
            {thread.tags && thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {thread.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
                {thread.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{thread.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Author & Category */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={thread.author.image} />
                  <AvatarFallback className="text-xs">
                    {thread.author.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span>{thread.author.name}</span>
              </div>

              {thread.category && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {thread.category.icon && <span>{thread.category.icon}</span>}
                    {thread.category.name}
                  </span>
                </>
              )}

              <span>•</span>
              <span>
                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Stats */}
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {thread.viewCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            {thread.replyCount}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            {thread.likeCount}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

