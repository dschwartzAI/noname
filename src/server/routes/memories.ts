/**
 * Memories API Routes - User business context storage
 *
 * Handles user memory management for AI context injection:
 * - CRUD operations for memories
 * - Category-based organization
 * - Multi-tenant isolation via organizations
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import * as schema from '../../../database/schema'

// Types
type Env = {
  DATABASE_URL: string
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

const memoriesApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply auth middleware to all routes
memoriesApp.use('*', requireAuth)
memoriesApp.use('*', injectOrganization)

// Validation schemas
const createMemorySchema = z.object({
  key: z.string().min(1).max(200).describe('Memory key/label'),
  value: z.string().min(1).max(2000).describe('Memory content'),
  category: z.enum(['business_info', 'target_audience', 'offers', 'current_projects', 'challenges', 'goals', 'personal_info']).describe('Memory category'),
  source: z.enum(['manual', 'auto', 'agent']).optional().describe('How the memory was created'),
})

const updateMemorySchema = z.object({
  key: z.string().min(1).max(200).optional().describe('Memory key/label'),
  value: z.string().min(1).max(2000).optional().describe('Memory content'),
  category: z.enum(['business_info', 'target_audience', 'offers', 'current_projects', 'challenges', 'goals', 'personal_info']).optional().describe('Memory category'),
})

const memoryIdSchema = z.object({
  id: z.string().describe('Memory ID'),
})

const listMemoriesSchema = z.object({
  category: z.enum(['business_info', 'target_audience', 'offers', 'current_projects', 'challenges', 'goals', 'personal_info']).optional().describe('Filter by category'),
})

/**
 * GET /api/v1/memories - List user's memories
 *
 * Returns all memories grouped by category
 */
memoriesApp.get('/', zValidator('query', listMemoriesSchema), async (c) => {
  try {
    const { category } = c.req.valid('query')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('📋 List memories:', { userId: user.id, organizationId, category })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Build where conditions
    const conditions = [
      eq(schema.memories.userId, user.id),
      eq(schema.memories.organizationId, organizationId),
    ]

    if (category) {
      conditions.push(eq(schema.memories.category, category))
    }

    const memories = await db.query.memories.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.memories.createdAt)],
    })

    console.log(`✅ Retrieved ${memories.length} memories`)

    return c.json({
      memories: memories.map(mem => ({
        id: mem.id,
        key: mem.key,
        value: mem.value,
        category: mem.category,
        source: mem.source,
        createdAt: mem.createdAt,
        updatedAt: mem.updatedAt,
      })),
    })

  } catch (error) {
    console.error('❌ List memories error:', error)
    return c.json({ error: 'Failed to list memories' }, 500)
  }
})

/**
 * POST /api/v1/memories - Create new memory
 *
 * Adds a new memory to user's context
 */
memoriesApp.post('/', zValidator('json', createMemorySchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('➕ Create memory:', { userId: user.id, organizationId, category: data.category })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    const memoryId = nanoid()

    await db.insert(schema.memories).values({
      id: memoryId,
      userId: user.id,
      organizationId: organizationId,
      key: data.key,
      value: data.value,
      category: data.category,
      source: data.source || 'manual',
    })

    console.log('✅ Memory created:', memoryId)

    return c.json({ id: memoryId, success: true })

  } catch (error) {
    console.error('❌ Create memory error:', error)
    return c.json({ error: 'Failed to create memory' }, 500)
  }
})

/**
 * PATCH /api/v1/memories/:id - Update memory
 *
 * Updates existing memory content
 */
memoriesApp.patch('/:id', zValidator('param', memoryIdSchema), zValidator('json', updateMemorySchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('✏️ Update memory:', { id, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify memory exists and user has access
    const memory = await db.query.memories.findFirst({
      where: and(
        eq(schema.memories.id, id),
        eq(schema.memories.userId, user.id),
        eq(schema.memories.organizationId, organizationId)
      ),
    })

    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404)
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() }
    if (updates.key !== undefined) updateData.key = updates.key
    if (updates.value !== undefined) updateData.value = updates.value
    if (updates.category !== undefined) updateData.category = updates.category

    // Update memory
    await db.update(schema.memories)
      .set(updateData)
      .where(eq(schema.memories.id, id))

    console.log('✅ Memory updated')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Update memory error:', error)
    return c.json({ error: 'Failed to update memory' }, 500)
  }
})

/**
 * DELETE /api/v1/memories/:id - Delete memory
 *
 * Permanently removes a memory
 */
memoriesApp.delete('/:id', zValidator('param', memoryIdSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('🗑️ Delete memory:', { id, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify memory exists and user has access
    const memory = await db.query.memories.findFirst({
      where: and(
        eq(schema.memories.id, id),
        eq(schema.memories.userId, user.id),
        eq(schema.memories.organizationId, organizationId)
      ),
    })

    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404)
    }

    // Delete memory
    await db.delete(schema.memories)
      .where(eq(schema.memories.id, id))

    console.log('✅ Memory deleted')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Delete memory error:', error)
    return c.json({ error: 'Failed to delete memory' }, 500)
  }
})

export default memoriesApp
