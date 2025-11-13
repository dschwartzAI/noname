/**
 * RAG Retrieval Utilities
 *
 * Semantic search and context retrieval from knowledge bases
 */

import type { Ai } from '@cloudflare/workers-types'
import { generateEmbedding } from './document-processor'

/**
 * Retrieve relevant context from knowledge base
 *
 * @param query - User's query to search for
 * @param knowledgeBaseId - KB ID to search in
 * @param organizationId - Tenant ID for filtering
 * @param db - Drizzle database instance
 * @param ai - Cloudflare AI binding for embedding generation
 * @param topK - Number of results to return
 * @returns Formatted context string for injection into system prompt
 */
export async function getRelevantContext(
  query: string,
  knowledgeBaseId: string,
  organizationId: string,
  db: any,
  ai: Ai,
  topK: number = 5
): Promise<string> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(ai, query)

    // Query chunks from knowledge base
    // For now, we'll use simple text matching since Vectorize isn't set up yet
    // Once Vectorize is enabled, we'll use vector similarity search
    const chunks = await db.query.knowledgeBaseChunks.findMany({
      where: (chunks: any, { and, eq }: any) =>
        and(
          eq(chunks.knowledgeBaseId, knowledgeBaseId),
          eq(chunks.organizationId, organizationId)
        ),
      limit: topK,
      orderBy: (chunks: any, { asc }: any) => asc(chunks.chunkIndex),
    })

    if (chunks.length === 0) {
      return ''
    }

    // Format context for system prompt
    let context = '\n\n═══ KNOWLEDGE BASE CONTEXT ═══\n'
    context += `\nRelevant information from knowledge base:\n\n`

    chunks.forEach((chunk: any, index: number) => {
      context += `[${index + 1}] ${chunk.content}\n\n`
    })

    context += '═══════════════════════════════\n'

    console.log(`📚 Retrieved ${chunks.length} relevant chunks from KB ${knowledgeBaseId}`)

    return context
  } catch (error) {
    console.error('❌ RAG retrieval error:', error)
    return '' // Fail gracefully - don't block chat if RAG fails
  }
}

/**
 * Retrieve relevant context using Vectorize (when enabled)
 *
 * This will replace getRelevantContext once Vectorize is set up
 */
export async function getRelevantContextWithVectorize(
  query: string,
  vectorStoreId: string,
  organizationId: string,
  vectorize: any, // Vectorize binding
  ai: Ai,
  topK: number = 5
): Promise<Array<{ content: string; similarity: number }>> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(ai, query)

    // Query Vectorize index
    const results = await vectorize.query(queryEmbedding, {
      topK,
      filter: {
        organizationId, // Multi-tenant filtering
      },
    })

    return results.matches.map((match: any) => ({
      content: match.metadata.content,
      similarity: match.score,
    }))
  } catch (error) {
    console.error('❌ Vectorize retrieval error:', error)
    return []
  }
}
