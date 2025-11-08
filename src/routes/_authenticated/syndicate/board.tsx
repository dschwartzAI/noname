"use client"

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, ThumbsUp, Eye, Pin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export const Route = createFileRoute('/_authenticated/syndicate/board')({
  component: MessageBoardPage
})

function MessageBoardPage() {
  const { data: categoriesData } = useQuery({
    queryKey: ['board-categories'],
    queryFn: async () => {
      const res = await fetch('/api/v1/board/categories')
      return res.json()
    }
  })

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['board-threads'],
    queryFn: async () => {
      const res = await fetch('/api/v1/board/threads')
      return res.json()
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  const categories = categoriesData?.categories || []
  const threads = threadsData?.threads || []

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Message Board</h1>
        <p className="text-muted-foreground mt-2">Community discussions and Q&A</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((cat: any) => (
            <TabsTrigger key={cat.id} value={cat.id}>{cat.icon} {cat.name}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {threads.map((thread: any) => (
            <Link key={thread.id} to="/syndicate/board/$threadId" params={{ threadId: thread.id }}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {thread.pinned && <Pin className="h-5 w-5 text-yellow-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2">{thread.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {thread.tags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        {thread.solved && <Badge className="text-xs">Solved</Badge>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {thread.replyCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    {thread.likeCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {thread.viewCount}
                  </span>
                  <span className="ml-auto text-xs">
                    {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>

        {categories.map((cat: any) => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">{cat.description}</p>
            {/* Filter threads by category */}
            {threads.filter((t: any) => t.categoryId === cat.id).map((thread: any) => (
              <Card key={thread.id}>
                <CardHeader>
                  <CardTitle className="text-base">{thread.title}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
