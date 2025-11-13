/**
 * useKnowledgeBases Hook - Knowledge Base Management
 *
 * Provides React Query hooks for managing knowledge bases and documents
 * Owner-only operations for RAG system
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
export interface KnowledgeBase {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  description: string | null
  vectorStoreId: string | null
  documentCount: number
  totalChunks: number
  totalTokens: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeBaseDocument {
  id: string
  knowledgeBaseId: string
  organizationId: string
  filename: string
  mimeType: string
  size: number
  r2Key: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  chunkCount: number
  tokenCount: number
  errorMessage: string | null
  uploadedAt: string
  processedAt: string | null
}

interface KnowledgeBasesResponse {
  knowledgeBases: KnowledgeBase[]
}

interface DocumentsResponse {
  documents: KnowledgeBaseDocument[]
}

interface CreateKBInput {
  name: string
  description?: string
}

interface UpdateKBInput {
  name?: string
  description?: string
}

interface ProcessDocumentResponse {
  success: boolean
  chunkCount: number
  tokenCount: number
}

/**
 * Fetch all knowledge bases for the organization
 */
export function useKnowledgeBases() {
  return useQuery<KnowledgeBasesResponse>({
    queryKey: ['knowledge-bases'],
    queryFn: async () => {
      const response = await fetch('/api/v1/knowledge-base')
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases')
      }
      return response.json()
    },
  })
}

/**
 * Fetch documents for a specific knowledge base
 */
export function useKnowledgeBaseDocuments(knowledgeBaseId: string | null) {
  return useQuery<DocumentsResponse>({
    queryKey: ['knowledge-base-documents', knowledgeBaseId],
    queryFn: async () => {
      if (!knowledgeBaseId) {
        throw new Error('No knowledge base ID provided')
      }
      const response = await fetch(`/api/v1/knowledge-base/${knowledgeBaseId}/documents`)
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      return response.json()
    },
    enabled: !!knowledgeBaseId,
  })
}

/**
 * Create a new knowledge base
 */
export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateKBInput) => {
      const response = await fetch('/api/v1/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create knowledge base')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate knowledge bases query to refetch
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}

/**
 * Update a knowledge base
 */
export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateKBInput }) => {
      const response = await fetch(`/api/v1/knowledge-base/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update knowledge base')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}

/**
 * Delete a knowledge base
 */
export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/knowledge-base/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete knowledge base')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}

/**
 * Upload a document to a knowledge base
 */
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ knowledgeBaseId, file }: { knowledgeBaseId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/v1/knowledge-base/${knowledgeBaseId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to upload document')
      }

      return response.json()
    },
    onSuccess: (_data, variables) => {
      // Invalidate documents query for this KB
      queryClient.invalidateQueries({
        queryKey: ['knowledge-base-documents', variables.knowledgeBaseId],
      })
      // Invalidate KBs to update document count
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}

/**
 * Delete a document from a knowledge base
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ knowledgeBaseId, documentId }: { knowledgeBaseId: string; documentId: string }) => {
      const response = await fetch(`/api/v1/knowledge-base/${knowledgeBaseId}/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete document')
      }

      return response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['knowledge-base-documents', variables.knowledgeBaseId],
      })
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}

/**
 * Process a document (chunk + embed)
 */
export function useProcessDocument() {
  const queryClient = useQueryClient()

  return useMutation<ProcessDocumentResponse, Error, { knowledgeBaseId: string; documentId: string }>({
    mutationFn: async ({ knowledgeBaseId, documentId }) => {
      const response = await fetch(
        `/api/v1/knowledge-base/${knowledgeBaseId}/documents/${documentId}/process`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to process document')
      }

      return response.json()
    },
    onSuccess: (_data, variables) => {
      // Invalidate documents query to show updated status
      queryClient.invalidateQueries({
        queryKey: ['knowledge-base-documents', variables.knowledgeBaseId],
      })
      // Invalidate KBs to update chunk/token counts
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
    },
  })
}
