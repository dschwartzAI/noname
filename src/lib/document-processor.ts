/**
 * Document Processing Utilities
 *
 * Handles text extraction, chunking, and embedding generation
 * for RAG knowledge base documents
 */

import type { Ai } from '@cloudflare/workers-types'

/**
 * Text chunking configuration
 */
export const CHUNK_CONFIG = {
  chunkSize: 1000, // characters per chunk
  chunkOverlap: 200, // overlap between chunks
  minChunkSize: 100, // minimum chunk size to keep
}

/**
 * Supported document types
 */
export const SUPPORTED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
} as const

/**
 * Extract text from document based on MIME type
 *
 * @param arrayBuffer - Document content as ArrayBuffer
 * @param mimeType - Document MIME type
 * @returns Extracted text content
 */
export async function extractText(
  arrayBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const fileType = SUPPORTED_MIME_TYPES[mimeType as keyof typeof SUPPORTED_MIME_TYPES]

  if (!fileType) {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  switch (fileType) {
    case 'txt':
    case 'md':
      return new TextDecoder().decode(arrayBuffer)

    case 'pdf':
      // For PDF, we'll need to use a PDF parsing library
      // For now, return a placeholder - PDF parsing will be added in next iteration
      throw new Error('PDF parsing not yet implemented. Use TXT or MD files for now.')

    case 'docx':
      // For DOCX, we'll need a DOCX parsing library
      throw new Error('DOCX parsing not yet implemented. Use TXT or MD files for now.')

    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

/**
 * Split text into chunks with overlap
 *
 * Uses sliding window approach to create overlapping chunks
 * for better semantic continuity in RAG retrieval
 *
 * @param text - Full document text
 * @param chunkSize - Target chunk size in characters
 * @param overlap - Overlap between chunks in characters
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_CONFIG.chunkSize,
  overlap: number = CHUNK_CONFIG.chunkOverlap
): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (normalizedText.length <= chunkSize) {
    return [normalizedText]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    // Extract chunk
    const endIndex = Math.min(startIndex + chunkSize, normalizedText.length)
    let chunk = normalizedText.slice(startIndex, endIndex)

    // Try to break at sentence boundary if not at document end
    if (endIndex < normalizedText.length) {
      const lastPeriod = chunk.lastIndexOf('. ')
      const lastQuestion = chunk.lastIndexOf('? ')
      const lastExclamation = chunk.lastIndexOf('! ')
      const lastNewline = chunk.lastIndexOf('\n')

      const breakPoints = [lastPeriod, lastQuestion, lastExclamation, lastNewline]
        .filter(i => i > chunkSize * 0.5) // Only consider break points in second half of chunk

      if (breakPoints.length > 0) {
        const breakPoint = Math.max(...breakPoints)
        chunk = chunk.slice(0, breakPoint + 1).trim()
      }
    }

    // Only add chunks that meet minimum size requirement
    if (chunk.length >= CHUNK_CONFIG.minChunkSize) {
      chunks.push(chunk)
    }

    // Move to next chunk with overlap
    startIndex += chunk.length - overlap

    // Prevent infinite loop
    if (startIndex <= chunks.length * CHUNK_CONFIG.minChunkSize) {
      startIndex = chunks.length * chunkSize
    }
  }

  return chunks
}

/**
 * Generate embedding vector using Cloudflare Workers AI
 *
 * Uses @cf/baai/bge-base-en-v1.5 model (768 dimensions)
 *
 * @param ai - Cloudflare AI binding
 * @param text - Text to embed
 * @returns Embedding vector (768-dim array)
 */
export async function generateEmbedding(
  ai: Ai,
  text: string
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text')
  }

  // Truncate text if too long (model has token limits)
  const maxLength = 8000 // Conservative limit for embedding models
  const truncatedText = text.slice(0, maxLength)

  try {
    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: truncatedText,
    }) as { data: number[][] }

    if (!response?.data?.[0]) {
      throw new Error('Invalid embedding response from AI model')
    }

    return response.data[0]
  } catch (error) {
    console.error('Embedding generation error:', error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Count approximate tokens in text
 *
 * Simple heuristic: ~4 characters per token for English text
 *
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Simple heuristic: average 4 characters per token
  return Math.ceil(text.length / 4)
}

/**
 * Process document: extract, chunk, and prepare for embedding
 *
 * @param arrayBuffer - Document content
 * @param mimeType - Document MIME type
 * @param chunkSize - Target chunk size
 * @param overlap - Chunk overlap
 * @returns Array of text chunks with metadata
 */
export async function processDocument(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  chunkSize: number = CHUNK_CONFIG.chunkSize,
  overlap: number = CHUNK_CONFIG.chunkOverlap
): Promise<Array<{ content: string; chunkIndex: number; tokenCount: number }>> {
  // Extract text from document
  const text = await extractText(arrayBuffer, mimeType)

  // Split into chunks
  const chunks = chunkText(text, chunkSize, overlap)

  // Add metadata to each chunk
  return chunks.map((content, index) => ({
    content,
    chunkIndex: index,
    tokenCount: estimateTokens(content),
  }))
}

/**
 * Batch generate embeddings for multiple chunks
 *
 * Processes chunks sequentially to avoid rate limits
 *
 * @param ai - Cloudflare AI binding
 * @param chunks - Array of text chunks
 * @returns Array of embeddings
 */
export async function batchGenerateEmbeddings(
  ai: Ai,
  chunks: string[]
): Promise<number[][]> {
  const embeddings: number[][] = []

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(ai, chunk)
    embeddings.push(embedding)

    // Small delay to avoid rate limits (optional)
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  return embeddings
}

/**
 * Search similar chunks using cosine similarity
 *
 * Note: In production, this will use Cloudflare Vectorize
 * This is a fallback for local/testing
 *
 * @param queryEmbedding - Query vector
 * @param chunkEmbeddings - Array of chunk vectors with metadata
 * @param topK - Number of results to return
 * @returns Top K most similar chunks
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export interface ChunkWithEmbedding {
  id: string
  content: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export function findSimilarChunks(
  queryEmbedding: number[],
  chunks: ChunkWithEmbedding[],
  topK: number = 5
): Array<ChunkWithEmbedding & { similarity: number }> {
  const similarities = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}
