/**
 * Knowledge Base API Routes - Cloudflare AI Search Integration
 *
 * Owner-only routes for managing knowledge bases
 * Documents are uploaded to R2 and automatically indexed by AI Search
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

// Types
type Env = {
  DATABASE_URL: string
  KNOWLEDGE_BASE_DOCS: R2Bucket
  AI_SEARCH?: any // Cloudflare AI Search binding (optional for localhost)
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_TOKEN: string
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
 * Sets up R2 path prefix for AI Search auto-indexing
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

    // Generate unique KB ID
    const kbId = crypto.randomUUID()

    // R2 path prefix for this KB: kb/{orgId}/{kbId}/
    const r2PathPrefix = `kb/${organizationId}/${kbId}/`

    const [knowledgeBase] = await db
      .insert(schema.knowledgeBases)
      .values({
        id: kbId,
        organizationId,
        createdBy: user.id,
        name: data.name,
        description: data.description || null,
        aiSearchStoreId: 'soloo-rag-store', // Default AI Search index
        r2PathPrefix,
        documentCount: 0,
      })
      .returning()

    console.log('✅ KB created:', knowledgeBase.id, '| R2 path:', r2PathPrefix)

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
 * Deletes knowledge base and all documents from R2 folder
 * AI Search will automatically remove indexed data
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

    console.log('🗑️ Deleting KB and R2 folder:', kb.r2PathPrefix)

    // Delete all documents in R2 folder
    try {
      const objects = await c.env.KNOWLEDGE_BASE_DOCS.list({ prefix: kb.r2PathPrefix })

      for (const obj of objects.objects) {
        await c.env.KNOWLEDGE_BASE_DOCS.delete(obj.key)
        console.log('  ✅ Deleted R2 file:', obj.key)
      }

      console.log(`✅ Deleted ${objects.objects.length} files from R2`)
    } catch (r2Error) {
      console.error('❌ Failed to delete R2 folder:', r2Error)
      // Continue with DB deletion even if R2 cleanup fails
    }

    // Delete KB record
    await db.delete(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, id))

    console.log('✅ KB deleted:', id)

    // Note: AI Search will automatically remove indexed data when documents are deleted from R2
    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete KB error:', error)
    return c.json({ error: 'Failed to delete knowledge base' }, 500)
  }
})

/**
 * POST /api/v1/knowledge-base/:id/upload - Upload document
 *
 * Uploads a document directly to R2 for AI Search auto-indexing
 * No database tracking - AI Search handles everything
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

    // Validate file type (AI Search supports these formats)
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/html',
      'text/csv',
    ]

    if (!allowedTypes.includes(file.type)) {
      return c.json({
        error: 'Invalid file type',
        message: 'Supported formats: PDF, TXT, MD, DOCX, HTML, CSV'
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

    // R2 key: {kb.r2PathPrefix}{timestamp}-{filename}
    const key = `${kb.r2PathPrefix}${timestamp}-${sanitizedName}`

    console.log('⬆️ Uploading document to R2 for AI Search auto-indexing:', key)

    // Upload to R2 with metadata for multi-tenant filtering
    const arrayBuffer = await file.arrayBuffer()
    await c.env.KNOWLEDGE_BASE_DOCS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        organizationId,
        knowledgeBaseId,
        filename: sanitizedName,
        uploadedAt: new Date().toISOString(),
      },
    })

    console.log('✅ Document uploaded to R2')

    // Trigger AI Search sync via Cloudflare API
    try {
      const syncUrl = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/search/${kb.aiSearchStoreId}/sync`

      console.log('🔄 Triggering AI Search sync:', syncUrl)

      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })

      if (syncResponse.ok) {
        const syncData = await syncResponse.json()
        console.log('✅ AI Search sync triggered:', syncData)
      } else {
        const errorText = await syncResponse.text()
        console.error('⚠️ Failed to trigger AI Search sync:', syncResponse.status, errorText)
        // Don't fail the upload if sync fails - file is already in R2
      }
    } catch (syncError) {
      console.error('⚠️ AI Search sync trigger error:', syncError)
      // Continue - file is uploaded successfully even if sync fails
    }

    // Increment document count
    await db
      .update(schema.knowledgeBases)
      .set({
        documentCount: kb.documentCount + 1,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.knowledgeBases.id, knowledgeBaseId))

    return c.json({
      success: true,
      key,
      message: 'Document uploaded successfully. AI Search sync triggered.',
    })
  } catch (error) {
    console.error('❌ Upload document error:', error)
    return c.json({ error: 'Failed to upload document' }, 500)
  }
})

/**
 * GET /api/v1/knowledge-base/:id/documents - List documents
 *
 * Lists all documents in the KB's R2 folder
 * Since we don't track documents in the database, we query R2 directly
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

    // List documents from R2
    const objects = await c.env.KNOWLEDGE_BASE_DOCS.list({ prefix: kb.r2PathPrefix })

    const documents = objects.objects.map(obj => ({
      key: obj.key,
      filename: obj.key.replace(kb.r2PathPrefix, ''),
      size: obj.size,
      uploadedAt: obj.uploaded,
      contentType: obj.httpMetadata?.contentType,
    }))

    return c.json({ documents })
  } catch (error) {
    console.error('❌ List documents error:', error)
    return c.json({ error: 'Failed to list documents' }, 500)
  }
})

/**
 * DELETE /api/v1/knowledge-base/:id/documents/:key - Delete document
 *
 * Deletes a document from R2
 * AI Search will automatically remove from index
 */
kbApp.delete('/:id/documents/*', zValidator('param', kbIdSchema), async (c) => {
  try {
    const { id: knowledgeBaseId } = c.req.valid('param')
    const organizationId = c.get('organizationId')

    // Get the full key from the URL (everything after /documents/)
    const fullPath = c.req.path
    const documentsPath = `/api/v1/knowledge-base/${knowledgeBaseId}/documents/`
    const documentKey = fullPath.substring(fullPath.indexOf(documentsPath) + documentsPath.length)

    if (!documentKey) {
      return c.json({ error: 'No document key provided' }, 400)
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

    // Reconstruct full R2 key
    const fullKey = `${kb.r2PathPrefix}${documentKey}`

    console.log('🗑️ Deleting document from R2:', fullKey)

    // Delete from R2
    await c.env.KNOWLEDGE_BASE_DOCS.delete(fullKey)

    // Decrement document count
    await db
      .update(schema.knowledgeBases)
      .set({
        documentCount: Math.max(0, kb.documentCount - 1),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.knowledgeBases.id, knowledgeBaseId))

    console.log('✅ Document deleted - AI Search will remove from index')

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete document error:', error)
    return c.json({ error: 'Failed to delete document' }, 500)
  }
})

export default kbApp
