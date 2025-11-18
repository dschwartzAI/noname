"use client"

import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'
import { ThreadPreviewCard } from '@/components/lms/board/thread-preview-card'
import { CreateThreadModal } from '@/components/lms/board/create-thread-modal'
import { InsertBoardThread } from '@/database/schema/message-board'

export const Route = createFileRoute('/_authenticated/community/feed')({
  component: CommunityFeedPage
})

function CommunityFeedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: categoriesData } = useQuery({
    queryKey: ['board-categories'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/board/categories')
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        const { mockBoardCategories } = await import('@/lib/mock-data/lms-mock-data')
        return { categories: mockBoardCategories }
      }
    }
  })

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['board-threads', selectedCategory, sortBy],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (selectedCategory !== 'all') params.append('category', selectedCategory)
        params.append('sortBy', sortBy)
        const res = await fetch(`/api/v1/board/threads?${params}`)
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        const { mockBoardThreads } = await import('@/lib/mock-data/lms-mock-data')
        // Filter by category if needed
        let threads = mockBoardThreads
        if (selectedCategory !== 'all') {
          threads = mockBoardThreads.filter(t => t.categoryId === selectedCategory)
        }
        return { threads }
      }
    }
  })

  const createThreadMutation = useMutation({
    mutationFn: async (threadData: Partial<InsertBoardThread>) => {
      const res = await fetch('/api/v1/board/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threadData)
      })
      if (!res.ok) throw new Error('Failed to create thread')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-threads'] })
      setShowCreateModal(false)
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    )
  }

  const categories = categoriesData?.categories || []
  const threads = threadsData?.threads || []

  // Filter threads by search
  const filteredThreads = threads.filter((thread: any) => {
    const matchesSearch = !searchQuery || 
      thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  // Separate pinned threads
  const pinnedThreads = filteredThreads.filter((t: any) => t.pinned)
  const regularThreads = filteredThreads.filter((t: any) => !t.pinned)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.slice(0, 4).map((cat: any) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread List */}
      <div className="space-y-4">
        {/* Pinned Posts */}
        {pinnedThreads.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              📌 Pinned
            </h2>
            {pinnedThreads.map((thread: any) => (
              <ThreadPreviewCard
                key={thread.id}
                thread={thread}
                onClick={() => navigate({ 
                  to: '/community/feed/$threadId', 
                  params: { threadId: thread.id } 
                })}
              />
            ))}
            <div className="border-t my-6" />
          </div>
        )}

        {/* Regular Posts */}
        {regularThreads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No posts found matching your search' : 'No posts yet. Be the first to start a discussion!'}
            </p>
          </div>
        ) : (
          regularThreads.map((thread: any) => (
            <ThreadPreviewCard
              key={thread.id}
              thread={thread}
              onClick={() => navigate({ 
                to: '/community/feed/$threadId', 
                params: { threadId: thread.id } 
              })}
            />
          ))
        )}
      </div>

      {/* Create Thread Modal */}
      <CreateThreadModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(threadData) => createThreadMutation.mutateAsync(threadData)}
        categories={categories}
      />
    </div>
  )
}


