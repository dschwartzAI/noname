import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc } from 'drizzle-orm'
import { instructors } from '../../../database/schema/instructors'
import { tenants } from '../../../database/schema/tenants'
import type { Env } from '../index'

const instructorsApp = new Hono<{
  Bindings: Env
  Variables: {
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
}>()

instructorsApp.use('*', requireAuth)
instructorsApp.use('*', injectOrganization)

const createInstructorSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional().or(z.literal('')).transform((val) => val || undefined),
  bio: z.string().optional().or(z.literal('')).transform((val) => val || undefined),
  avatarUrl: z.string().optional().or(z.literal('')).transform((val) => val || undefined),
})

const updateInstructorSchema = createInstructorSchema.partial()

const instructorIdSchema = z.object({
  id: z.string().uuid(),
})

async function getTenantId(env: { DATABASE_URL: string }, organizationId: string) {
  const sqlClient = neon(env.DATABASE_URL)
  const db = drizzle(sqlClient, { schema: { tenants } })

  const subdomain = organizationId.replace(/[^a-z0-9-]/gi, '-').toLowerCase().substring(0, 50)

  const [existingTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.subdomain, subdomain))
    .limit(1)

  if (existingTenant) {
    return existingTenant.id
  }

  const tenantId = crypto.randomUUID()
  await db.insert(tenants).values({
    id: tenantId,
    name: `Organization ${organizationId.substring(0, 8)}`,
    subdomain,
    tier: 'free',
    active: true,
  })

  return tenantId
}

instructorsApp.get('/', async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')

  if (!user || !organizationId) {
    return c.json({ error: 'No organization context' }, 403)
  }

  const sqlClient = neon(c.env.DATABASE_URL)
  const db = drizzle(sqlClient, { schema: { instructors } })

  try {
    const tenantId = await getTenantId(c.env, organizationId)

    const records = await db
      .select()
      .from(instructors)
      .where(eq(instructors.tenantId, tenantId))
      .orderBy(desc(instructors.createdAt))

    return c.json({ instructors: records })
  } catch (error) {
    console.error('❌ List instructors error:', error)
    return c.json({ error: 'Failed to fetch instructors' }, 500)
  }
})

instructorsApp.post('/', zValidator('json', createInstructorSchema), async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const organizationRole = c.get('organizationRole')

  if (!user || !organizationId) {
    return c.json({ error: 'No organization context' }, 403)
  }

  if (organizationRole !== 'owner' && !user.isGod) {
    return c.json({ error: 'Only organization owners can create instructors' }, 403)
  }

  const data = c.req.valid('json')

  const sqlClient = neon(c.env.DATABASE_URL)
  const db = drizzle(sqlClient, { schema: { instructors } })

  try {
    const tenantId = await getTenantId(c.env, organizationId)

    const [newInstructor] = await db
      .insert(instructors)
      .values({
        tenantId,
        name: data.name,
        title: data.title,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
      })
      .returning()

    return c.json({ instructor: newInstructor, success: true })
  } catch (error) {
    console.error('❌ Create instructor error:', error)
    return c.json({ error: 'Failed to create instructor' }, 500)
  }
})

instructorsApp.patch(
  '/:id',
  zValidator('param', instructorIdSchema),
  zValidator('json', updateInstructorSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!user || !organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can update instructors' }, 403)
    }

    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { instructors } })

    try {
      const tenantId = await getTenantId(c.env, organizationId)

      const [current] = await db
        .select()
        .from(instructors)
        .where(and(eq(instructors.id, id), eq(instructors.tenantId, tenantId)))
        .limit(1)

      if (!current) {
        return c.json({ error: 'Instructor not found' }, 404)
      }

      const [updated] = await db
        .update(instructors)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(instructors.id, id))
        .returning()

      return c.json({ instructor: updated, success: true })
    } catch (error) {
      console.error('❌ Update instructor error:', error)
      return c.json({ error: 'Failed to update instructor' }, 500)
    }
  }
)

instructorsApp.delete(
  '/:id',
  zValidator('param', instructorIdSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!user || !organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can delete instructors' }, 403)
    }

    const { id } = c.req.valid('param')

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { instructors } })

    try {
      const tenantId = await getTenantId(c.env, organizationId)

      const [existing] = await db
        .select({ id: instructors.id })
        .from(instructors)
        .where(and(eq(instructors.id, id), eq(instructors.tenantId, tenantId)))
        .limit(1)

      if (!existing) {
        return c.json({ error: 'Instructor not found' }, 404)
      }

      await db.delete(instructors).where(eq(instructors.id, id))

      return c.json({ success: true })
    } catch (error) {
      console.error('❌ Delete instructor error:', error)
      return c.json({ error: 'Failed to delete instructor' }, 500)
    }
  }
)

/**
 * GET /api/v1/instructors/image/:key - Serve instructor avatar from R2
 */
instructorsApp.get('/image/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key')

    if (!c.env.R2_ASSETS) {
      return c.json({ error: 'Storage not configured' }, 500)
    }

    const object = await c.env.R2_ASSETS.get(key)

    if (!object) {
      return c.notFound()
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('❌ Instructor avatar serve error:', error)
    return c.json({ error: 'Failed to serve avatar' }, 500)
  }
})

/**
 * POST /api/v1/instructors/upload - Upload instructor avatar to R2
 */
instructorsApp.post('/upload', async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const organizationRole = c.get('organizationRole')

  if (!user || !organizationId) {
    return c.json({ error: 'No organization context' }, 403)
  }

  if (organizationRole !== 'owner' && !user.isGod) {
    return c.json({ error: 'Only organization owners can upload avatars' }, 403)
  }

  if (!c.env.R2_ASSETS) {
    return c.json({ error: 'Storage not configured' }, 500)
  }

  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are allowed' }, 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size must be less than 5MB' }, 400)
    }

    const tenantId = await getTenantId(c.env, organizationId)

    const extension = file.name.split('.').pop() || 'png'
    const key = `instructors/${tenantId}/${crypto.randomUUID()}.${extension}`

    const arrayBuffer = await file.arrayBuffer()

    await c.env.R2_ASSETS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    })

    // Use Workers route instead of R2 public URL for instant availability
    const url = `/api/v1/instructors/image/${key}`

    console.log('✅ Instructor avatar uploaded:', { key, url })

    return c.json({ url })
  } catch (error) {
    console.error('❌ Instructor avatar upload error:', error)
    return c.json({ error: 'Failed to upload avatar' }, 500)
  }
})

export default instructorsApp
