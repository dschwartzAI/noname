"use client"

import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ArrowLeft, 
  ThumbsUp, 
  MessageSquare, 
  Pin, 
  Lock,
  CheckCircle,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { ReplyCard } from '@/components/lms/board/reply-card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/syndicate/board/$threadId')({
  component: ThreadPage
})

function ThreadPage() {
  const { threadId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // TODO: Replace with actual user data
  const isAdmin = true
  const currentUserId = 'user123'

  const { data, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/board/threads/${threadId}`)
      return res.json()
    }
  })

  const replyMutation = useMutation({
    mutationFn: async ({ content, parentReplyId }: { content: string, parentReplyId?: string }) => {
      await fetch(`/api/v1/board/threads/${threadId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentReplyId })
      })
    },
    onSuccess: () => {
      setReply('')
      setReplyingTo(null)
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
    }
  })

  const likeThreadMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/v1/board/threads/${threadId}/like`, { method: 'POST' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
  })

  const likeReplyMutation = useMutation({
    mutationFn: async (replyId: string) => {
      await fetch(`/api/v1/board/replies/${replyId}/like`, { method: 'POST' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
  })

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-6">
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  const { thread, replies, category } = data

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate({ to: '/syndicate/board' })}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Message Board
      </Button>

      {/* Thread */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start gap-4">
            {/* Author Avatar */}
            <Avatar className="h-12 w-12">
              <AvatarImage src={thread.author.image} />
              <AvatarFallback>
                {thread.author.name.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Thread Content */}
            <div className="flex-1 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {thread.pinned && (
                      <Pin className="h-5 w-5 text-yellow-600" />
                    )}
                    {thread.locked && (
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h1 className="text-2xl font-bold">{thread.title}</h1>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-medium">{thread.author.name}</span>
                    {category && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {category.icon && <span>{category.icon}</span>}
                          {category.name}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        {thread.pinned ? 'Unpin Post' : 'Pin Post'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        {thread.locked ? 'Unlock Post' : 'Lock Post'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        {thread.solved ? 'Mark Unsolved' : 'Mark Solved'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Tags */}
              {thread.tags && thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {thread.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                  {thread.solved && (
                    <Badge className="bg-green-600 gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Solved
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* Content */}
          <p className="text-base whitespace-pre-wrap">{thread.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => likeThreadMutation.mutate()}
              className={cn(thread.isLiked && "text-blue-600")}
            >
              <ThumbsUp className={cn("h-4 w-4 mr-2", thread.isLiked && "fill-current")} />
              {thread.likeCount > 0 && thread.likeCount}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={thread.locked}
              onClick={() => document.getElementById('reply-input')?.focus()}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Reply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {replies?.length || 0} {replies?.length === 1 ? 'Reply' : 'Replies'}
        </h3>
        
        {replies?.map((reply: any) => (
          <ReplyCard
            key={reply.id}
            reply={reply}
            onLike={() => likeReplyMutation.mutate(reply.id)}
            onReply={() => setReplyingTo(reply.id)}
            onEdit={reply.authorId === currentUserId ? () => {} : undefined}
            onDelete={reply.authorId === currentUserId || isAdmin ? () => {} : undefined}
            canModerate={isAdmin}
          />
        ))}
      </div>

      {/* Reply Input */}
      {!thread.locked && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {replyingTo && (
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">
                  Replying to a comment
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
            <Textarea
              id="reply-input"
              placeholder="Write your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
            />
            <Button 
              onClick={() => replyMutation.mutate({ content: reply, parentReplyId: replyingTo || undefined })} 
              disabled={!reply.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? 'Posting...' : 'Post Reply'}
            </Button>
          </CardContent>
        </Card>
      )}

      {thread.locked && (
        <Card>
          <CardContent className="py-6 text-center">
            <Lock className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">This thread is locked. No new replies can be added.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
