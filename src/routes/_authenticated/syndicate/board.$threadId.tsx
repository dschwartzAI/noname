"use client"

import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThumbsUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/syndicate/board/$threadId')({
  component: ThreadPage
})

function ThreadPage() {
  const { threadId } = Route.useParams()
  const [reply, setReply] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/board/threads/${threadId}`)
      return res.json()
    }
  })

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      await fetch(`/api/v1/board/threads/${threadId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
    },
    onSuccess: () => {
      setReply('')
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
    }
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/v1/board/threads/${threadId}/like`, { method: 'POST' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
  })

  if (isLoading) return <div className="container py-6"><Skeleton className="h-96" /></div>

  const { thread, replies } = data

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">{thread.title}</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap">{thread.content}</p>
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => likeMutation.mutate()}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              {thread.likeCount}
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold">{replies?.length || 0} Replies</h3>
        {replies?.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="py-4">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <p className="whitespace-pre-wrap text-sm">{r.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea
            placeholder="Write your reply..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
          />
          <Button onClick={() => replyMutation.mutate(reply)} disabled={!reply.trim()}>
            Post Reply
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
