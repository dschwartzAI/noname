/**
 * useAgents Hook - Fetch organization's available tools/agents
 *
 * Provides access to the organization's published agents/tools
 * for tool selection and agent configuration
 */

import { useQuery } from '@tanstack/react-query'

interface Agent {
  id: string
  name: string
  description: string | null
  icon: string | null
  avatar?: {
    source: 'emoji' | 'url' | 'upload'
    value: string
  } | null
  provider: 'openai' | 'anthropic' | 'xai' | 'bedrock'
  model: string
  tier: 'free' | 'pro' | 'enterprise'
  published: boolean
  isSystem: boolean
  usageCount: number
  createdAt: string
}

interface AgentsResponse {
  agents: Agent[]
}

/**
 * Fetch organization's published agents/tools
 */
export function useAgents() {
  return useQuery<AgentsResponse>({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetch('/api/v1/agents')
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      return response.json()
    },
  })
}

/**
 * Export types for use in components
 */
export type { Agent, AgentsResponse }
