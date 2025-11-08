/**
 * TanStack Query hook for fetching conversation list
 *
 * Fetches user's conversations from the backend API with automatic
 * caching, refetching, and error handling
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Conversation } from '@/features/ai-chat/types'

interface APIConversation {
  id: string
  title: string
  model: string
  toolId: string | null
  createdAt: string
  updatedAt: string
}

interface ConversationsResponse {
  conversations: APIConversation[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

/**
 * Fetch conversations from backend API and transform to UI format
 */
async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch('/api/v1/chat?limit=50&offset=0', {
    credentials: 'include', // Include session cookies
  })

  if (!response.ok) {
    throw new Error('Failed to fetch conversations')
  }

  const data: ConversationsResponse = await response.json()

  // Transform API response to match UI Conversation type
  return data.conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    agent: {
      id: conv.toolId || 'default',
      name: conv.model, // Use model name as agent name
      avatar: undefined,
      greeting: '',
      model: conv.model,
    },
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
    lastMessage: undefined, // Not included in list view
    messages: undefined,
  }))
}

/**
 * Hook to fetch and manage conversation list
 *
 * @example
 * ```tsx
 * const { data: conversations, isLoading, error } = useConversations()
 * ```
 */
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      try {
        const result = await fetchConversations()
        return result
      } catch (error) {
        console.error('❌ Failed to fetch conversations:', error)
        throw error
      }
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 2, // Retry failed requests twice
  })
}

/**
 * Hook to invalidate conversations query (force refetch)
 *
 * Use this after creating, updating, or deleting a conversation
 *
 * @example
 * ```tsx
 * const invalidateConversations = useInvalidateConversations()
 * await fetch('/api/v1/chat', { method: 'POST', ... })
 * invalidateConversations() // Refresh conversation list
 * ```
 */
export function useInvalidateConversations() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }
}
