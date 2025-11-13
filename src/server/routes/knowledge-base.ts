/**
 * Knowledge Base API Routes - RAG Document Management
 *
 * Owner-only routes for managing knowledge bases and documents
 * Multi-tenant with organizationId isolation
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { requireOwner } from '../middleware/require-owner'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../../database/schema'
import { processDocument, batchGenerateEmbeddings } from '../../lib/document-processor'

// Types
type Env = {
  DATABASE_URL: string
  R2_ASSETS: R2Bucket
  AI: any // Cloudflare AI binding
}

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    isGod: boolean
  }
  organizationId?: string
  organizationRole?: string
}

const kbApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply middleware stack (owner-only access)
kbApp.use('*', requireAuth)
kbApp.use('*', injectOrganization)
kbApp.use('*', requireOwner)

// Validation schemas
const createKBSchema = z.object({
  name: z.string().min(1).max(100).describe('Knowledge base name'),
  description: z.string().max(500).optional().describe('Knowledge base description'),
})

const updateKBSchema = z.object({
  name: z.string().min(1).max(100).optional().describe('Knowledge base name'),
  description: z.string().max(500).optional().describe('Knowledge base description'),
})

const kbIdSchema = z.object({
  id: z.string().uuid(),
})

const documentIdSchema = z.object({
  documentId: z.string().uuid(),
})

/**
 * GET /api/v1/knowledge-base - List knowledge bases
 *
 * Returns all knowledge bases for the organization
 */
kbApp.get('/', async (c) => {
  try {
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    const knowledgeBases = await db.query.knowledgeBases.findMany({
      where: eq(schema.knowledgeBases.organizationId, organizationId),
      orderBy: desc(schema.knowledgeBases.createdAt),
    })

    return c.json({ knowledgeBases })
  } catch (error) {
    console.error('❌ List KB error:', error)
    return c.json({ error: 'Failed to list knowledge bases' }, 500)
  }
})

/**
 * POST /api/v1/knowledge-base - Create knowledge base
 *
 * Creates a new knowledge base for the organization
 */
kbApp.post('/', zValidator('json', createKBSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('➕ Create KB:', { userId: user.id, organizationId, name: data.name })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Generate vectorStoreId for Cloudflare Vectorize
    const vectorStoreId = `kb-${crypto.randomUUID()}`

    const [knowledgeBase] = await db
      .insert(schema.knowledgeBases)
      .values({
        organizationId,
        createdBy: user.id,
        name: data.name,
        description: data.description || null,
        vectorStoreId,
        documentCount: 0,
        totalChunks: 0,
        totalTokens: 0,
      })
      .returning()

    console.log('✅ KB created:', knowledgeBase.id)

    return c.json({ knowledgeBase })
  } catch (error) {
    console.error('❌ Create KB error:', error)
    return c.json({ error: 'Failed to create knowledge base' }, 500)
  }
})

/**
 * PATCH /api/v1/knowledge-base/:id - Update knowledge base
 *
 * Updates knowledge base metadata
 */
kbApp.patch('/:id', zValidator('param', kbIdSchema), zValidator('json', updateKBSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify KB exists and belongs to organization
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(
        eq(schema.knowledgeBases.id, id),
        eq(schema.knowledgeBases.organizationId, organizationId)
      ),
    })

    if (!kb) {
      return c.json({ error: 'Knowledge base not found' }, 404)
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() }
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description

    await db
      .update(schema.knowledgeBases)
      .set(updateData)
      .where(eq(schema.knowledgeBases.id, id))

    const updatedKB = await db.query.knowledgeBases.findFirst({
      where: eq(schema.knowledgeBases.id, id),
    })

    return c.json({ knowledgeBase: updatedKB })
  } catch (error) {
    console.error('❌ Update KB error:', error)
    return c.json({ error: 'Failed to update knowledge base' }, 500)
  }
})

/**
 * DELETE /api/v1/knowledge-base/:id - Delete knowledge base
 *
 * Deletes knowledge base and all associated documents
 */
kbApp.delete('/:id', zValidator('param', kbIdSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify KB exists and belongs to organization
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(
        eq(schema.knowledgeBases.id, id),
        eq(schema.knowledgeBases.organizationId, organizationId)
      ),
    })

    if (!kb) {
      return c.json({ error: 'Knowledge base not found' }, 404)
    }

    // Get all documents to delete from R2
    const documents = await db.query.knowledgeBaseDocuments.findMany({
      where: eq(schema.knowledgeBaseDocuments.knowledgeBaseId, id),
    })

    // Delete documents from R2
    for (const doc of documents) {
      try {
        await c.env.R2_ASSETS.delete(doc.r2Key)
      } catch (r2Error) {
        console.error(`Failed to delete R2 file: ${doc.r2Key}`, r2Error)
      }
    }

    // Delete KB (cascade will delete documents and chunks)
    await db.delete(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, id))

    // TODO: Delete vectors from Vectorize index

    console.log('✅ KB deleted:', id)

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete KB error:', error)
    return c.json({ error: 'Failed to delete knowledge base' }, 500)
  }
})

/**
 * GET /api/v1/knowledge-base/:id/documents - List documents
 *
 * Returns all documents in a knowledge base
 */
kbApp.get('/:id/documents', zValidator('param', kbIdSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify KB exists and belongs to organization
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(
        eq(schema.knowledgeBases.id, id),
        eq(schema.knowledgeBases.organizationId, organizationId)
      ),
    })

    if (!kb) {
      return c.json({ error: 'Knowledge base not found' }, 404)
    }

    const documents = await db.query.knowledgeBaseDocuments.findMany({
      where: eq(schema.knowledgeBaseDocuments.knowledgeBaseId, id),
      orderBy: desc(schema.knowledgeBaseDocuments.uploadedAt),
    })

    return c.json({ documents })
  } catch (error) {
    console.error('❌ List documents error:', error)
    return c.json({ error: 'Failed to list documents' }, 500)
  }
})

/**
 * POST /api/v1/knowledge-base/:id/upload - Upload document
 *
 * Uploads a document to the knowledge base and R2
 */
kbApp.post('/:id/upload', zValidator('param', kbIdSchema), async (c) => {
  try {
    const { id: knowledgeBaseId } = c.req.valid('param')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify KB exists and belongs to organization
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(
        eq(schema.knowledgeBases.id, knowledgeBaseId),
        eq(schema.knowledgeBases.organizationId, organizationId)
      ),
    })

    if (!kb) {
      return c.json({ error: 'Knowledge base not found' }, 404)
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate file type (PDFs and text files only)
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ]

    if (!allowedTypes.includes(file.type)) {
      return c.json({
        error: 'Invalid file type',
        message: 'Only PDF, TXT, MD, and DOCX files are supported'
      }, 400)
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return c.json({
        error: 'File too large',
        message: 'Maximum file size is 10MB'
      }, 400)
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = Date.now()

    // R2 key: knowledge-base/{orgId}/{kbId}/{timestamp}-{filename}
    const key = `knowledge-base/${organizationId}/${knowledgeBaseId}/${timestamp}-${sanitizedName}`

    console.log('⬆️ Uploading document to R2:', key)

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer()
    await c.env.R2_ASSETS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    })

    console.log('✅ R2 upload successful')

    // Create document record
    const [document] = await db
      .insert(schema.knowledgeBaseDocuments)
      .values({
        knowledgeBaseId,
        organizationId,
        filename: sanitizedName,
        mimeType: file.type,
        size: file.size,
        r2Key: key,
        status: 'pending',
        chunkCount: 0,
        tokenCount: 0,
      })
      .returning()

    // Increment document count on KB
    await db
      .update(schema.knowledgeBases)
      .set({
        documentCount: kb.documentCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.knowledgeBases.id, knowledgeBaseId))

    console.log('✅ Document record created:', document.id)

    // TODO: Trigger background job to process document (chunk + embed)
    // For now, return pending status - processing will happen via separate endpoint

    return c.json({ document })
  } catch (error) {
    console.error('❌ Upload document error:', error)
    return c.json({ error: 'Failed to upload document' }, 500)
  }
})

/**
 * DELETE /api/v1/knowledge-base/:id/documents/:documentId - Delete document
 *
 * Deletes a document from the knowledge base
 */
kbApp.delete(
  '/:id/documents/:documentId',
  zValidator('param', kbIdSchema.merge(documentIdSchema)),
  async (c) => {
    try {
      const { id: knowledgeBaseId, documentId } = c.req.valid('param')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema })

      // Verify document exists and belongs to organization
      const document = await db.query.knowledgeBaseDocuments.findFirst({
        where: and(
          eq(schema.knowledgeBaseDocuments.id, documentId),
          eq(schema.knowledgeBaseDocuments.knowledgeBaseId, knowledgeBaseId),
          eq(schema.knowledgeBaseDocuments.organizationId, organizationId)
        ),
      })

      if (!document) {
        return c.json({ error: 'Document not found' }, 404)
      }

      // Delete from R2
      try {
        await c.env.R2_ASSETS.delete(document.r2Key)
      } catch (r2Error) {
        console.error(`Failed to delete R2 file: ${document.r2Key}`, r2Error)
      }

      // Delete document (cascade will delete chunks)
      await db
        .delete(schema.knowledgeBaseDocuments)
        .where(eq(schema.knowledgeBaseDocuments.id, documentId))

      // Update KB document count
      const kb = await db.query.knowledgeBases.findFirst({
        where: eq(schema.knowledgeBases.id, knowledgeBaseId),
      })

      if (kb) {
        await db
          .update(schema.knowledgeBases)
          .set({
            documentCount: Math.max(0, kb.documentCount - 1),
            totalChunks: Math.max(0, kb.totalChunks - document.chunkCount),
            totalTokens: Math.max(0, kb.totalTokens - document.tokenCount),
            updatedAt: new Date(),
          })
          .where(eq(schema.knowledgeBases.id, knowledgeBaseId))
      }

      // TODO: Delete vectors from Vectorize index

      console.log('✅ Document deleted:', documentId)

      return c.json({ success: true })
    } catch (error) {
      console.error('❌ Delete document error:', error)
      return c.json({ error: 'Failed to delete document' }, 500)
    }
  }
)

/**
 * POST /api/v1/knowledge-base/:id/documents/:documentId/process - Process document
 *
 * Chunks document, generates embeddings, and stores in Vectorize
 */
kbApp.post(
  '/:id/documents/:documentId/process',
  zValidator('param', kbIdSchema.merge(documentIdSchema)),
  async (c) => {
    try {
      const { id: knowledgeBaseId, documentId } = c.req.valid('param')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      if (!c.env.AI) {
        return c.json({ error: 'AI binding not available' }, 500)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema })

      // Verify document exists and belongs to organization
      const document = await db.query.knowledgeBaseDocuments.findFirst({
        where: and(
          eq(schema.knowledgeBaseDocuments.id, documentId),
          eq(schema.knowledgeBaseDocuments.knowledgeBaseId, knowledgeBaseId),
          eq(schema.knowledgeBaseDocuments.organizationId, organizationId)
        ),
      })

      if (!document) {
        return c.json({ error: 'Document not found' }, 404)
      }

      // Check if already processed or processing
      if (document.status === 'processing') {
        return c.json({ error: 'Document is already being processed' }, 409)
      }

      if (document.status === 'completed') {
        return c.json({ error: 'Document has already been processed' }, 409)
      }

      console.log('🔄 Processing document:', documentId)

      // Update status to processing
      await db
        .update(schema.knowledgeBaseDocuments)
        .set({ status: 'processing' })
        .where(eq(schema.knowledgeBaseDocuments.id, documentId))

      try {
        // Download document from R2
        const r2Object = await c.env.R2_ASSETS.get(document.r2Key)

        if (!r2Object) {
          throw new Error('Document not found in R2')
        }

        const arrayBuffer = await r2Object.arrayBuffer()

        // Process document (extract text, chunk)
        const chunks = await processDocument(arrayBuffer, document.mimeType)

        console.log(`📝 Generated ${chunks.length} chunks`)

        // Generate embeddings for all chunks
        const chunkTexts = chunks.map(c => c.content)
        const embeddings = await batchGenerateEmbeddings(c.env.AI, chunkTexts)

        console.log(`🧮 Generated ${embeddings.length} embeddings`)

        // Store chunks in database and prepare for Vectorize
        const chunkRecords = []
        let totalTokens = 0

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const embedding = embeddings[i]
          const vectorId = crypto.randomUUID()

          // Insert chunk into database
          const [chunkRecord] = await db
            .insert(schema.knowledgeBaseChunks)
            .values({
              documentId,
              knowledgeBaseId,
              organizationId,
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              vectorId,
            })
            .returning()

          chunkRecords.push({
            ...chunkRecord,
            embedding,
          })

          totalTokens += chunk.tokenCount
        }

        // TODO: Insert into Vectorize index
        // This will be implemented when we enable Vectorize in wrangler.toml
        // For now, chunks are stored in DB for retrieval

        // Update document status
        await db
          .update(schema.knowledgeBaseDocuments)
          .set({
            status: 'completed',
            chunkCount: chunks.length,
            tokenCount: totalTokens,
            processedAt: new Date(),
          })
          .where(eq(schema.knowledgeBaseDocuments.id, documentId))

        // Update KB stats
        const kb = await db.query.knowledgeBases.findFirst({
          where: eq(schema.knowledgeBases.id, knowledgeBaseId),
        })

        if (kb) {
          await db
            .update(schema.knowledgeBases)
            .set({
              totalChunks: kb.totalChunks + chunks.length,
              totalTokens: kb.totalTokens + totalTokens,
              updatedAt: new Date(),
            })
            .where(eq(schema.knowledgeBases.id, knowledgeBaseId))
        }

        console.log('✅ Document processing complete:', documentId)

        return c.json({
          success: true,
          chunkCount: chunks.length,
          tokenCount: totalTokens,
        })
      } catch (processingError) {
        console.error('❌ Processing error:', processingError)

        // Update document status to failed
        await db
          .update(schema.knowledgeBaseDocuments)
          .set({
            status: 'failed',
            errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
          })
          .where(eq(schema.knowledgeBaseDocuments.id, documentId))

        return c.json({
          error: 'Failed to process document',
          message: processingError instanceof Error ? processingError.message : 'Unknown error',
        }, 500)
      }
    } catch (error) {
      console.error('❌ Process document error:', error)
      return c.json({ error: 'Failed to process document' }, 500)
    }
  }
)

export default kbApp
