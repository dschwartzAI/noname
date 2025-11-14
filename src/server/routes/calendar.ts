/**
 * Calendar API Routes
 * 
 * Handles calendar events for the Syndicate LMS
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { calendarEvents, eventRsvps } from '../../../database/schema/calendar'
import { tenants } from '../../../database/schema/tenants'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'

type Env = {
  DATABASE_URL: string
}

type Variables = {
  user: {
    id: string
    email: string
    name?: string
  }
  organizationId: string
}

const calendarApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply auth and organization middleware to all routes
calendarApp.use('*', requireAuth)
calendarApp.use('*', injectOrganization)

/**
 * Helper: Get or create tenant for organization
 */
async function getTenantId(env: Env, organizationId: string): Promise<string> {
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

  // Create new tenant for this organization
  const tenantId = crypto.randomUUID()
  await db.insert(tenants).values({
    id: tenantId,
    name: `Organization ${organizationId.substring(0, 8)}`,
    subdomain,
    tier: 'free',
    active: true,
  })

  console.log(`✅ Created tenant ${tenantId} for organization ${organizationId}`)
  return tenantId
}

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(['meeting', 'class', 'deadline', 'event', 'office_hours']).default('event'),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  allDay: z.boolean().default(false).optional(),
  location: z.string().optional().nullable(),
  meetingUrl: z.string().url().optional().nullable().or(z.literal('')),
  attendees: z.array(z.object({
    userId: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    rsvp: z.enum(['yes', 'no', 'maybe']).optional()
  })).default([]).optional(),
  recurring: z.boolean().default(false).optional(),
  recurrenceRule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number(),
    until: z.string().optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional()
  }).optional().nullable(),
  reminders: z.array(z.object({
    type: z.enum(['email', 'notification']),
    minutesBefore: z.number()
  })).default([]).optional(),
  color: z.string().default('#3b82f6').optional(),
  category: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private', 'organization']).default('organization').optional()
})

const updateEventSchema = createEventSchema.partial()

// ============================================
// EVENTS
// ============================================

/**
 * GET /api/v1/calendar - Get events for a date range
 */
calendarApp.get('/', 
  zValidator('query', z.object({
    startDate: z.string(),
    endDate: z.string(),
    type: z.enum(['meeting', 'class', 'deadline', 'event', 'office_hours']).optional(),
    category: z.string().optional()
  })),
  async (c) => {
    try {
      const { startDate, endDate, type, category } = c.req.valid('query')
      const user = c.get('user')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema: { calendarEvents, eventRsvps } })

      const tenantId = await getTenantId(c.env, organizationId)
      
      const conditions = [
        eq(calendarEvents.tenantId, tenantId),
        eq(calendarEvents.cancelled, false),
        gte(calendarEvents.endTime, new Date(startDate)),
        lte(calendarEvents.startTime, new Date(endDate))
      ]
      
      if (type) {
        conditions.push(eq(calendarEvents.type, type))
      }
      
      if (category) {
        conditions.push(eq(calendarEvents.category, category))
      }
      
      // Get events with RSVP status
      const events = await db
        .select({
          event: calendarEvents,
          userRsvp: sql<string | null>`(
            select ${eventRsvps.response}
            from ${eventRsvps}
            where ${eventRsvps.eventId} = ${calendarEvents.id}
            and ${eventRsvps.userId} = ${user.id}
          )`
        })
        .from(calendarEvents)
        .where(and(...conditions))
        .orderBy(calendarEvents.startTime)
      
      return c.json({ events })
    } catch (error) {
      console.error('❌ Get calendar events error:', error)
      return c.json({ error: 'Failed to fetch events' }, 500)
    }
  }
)

/**
 * GET /api/v1/calendar/:eventId - Get single event
 */
calendarApp.get('/:eventId', async (c) => {
  try {
    const { eventId } = c.req.param()
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { calendarEvents, eventRsvps } })

    const tenantId = await getTenantId(c.env, organizationId)
    
    const [event] = await db
      .select({
        event: calendarEvents,
        userRsvp: sql<string | null>`(
          select ${eventRsvps.response}
          from ${eventRsvps}
          where ${eventRsvps.eventId} = ${calendarEvents.id}
          and ${eventRsvps.userId} = ${user.id}
        )`
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.tenantId, tenantId)
        )
      )
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }
    
    // Get all RSVPs
    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId))
    
    return c.json({ ...event, rsvps })
  } catch (error) {
    console.error('❌ Get event error:', error)
    return c.json({ error: 'Failed to fetch event' }, 500)
  }
})

/**
 * POST /api/v1/calendar - Create event
 */
calendarApp.post('/',
  zValidator('json', createEventSchema),
  async (c) => {
    try {
      const data = c.req.valid('json')
      const user = c.get('user')
      const organizationId = c.get('organizationId')

      console.log('📅 Creating calendar event:', { data, organizationId, userId: user.id })

      if (!organizationId) {
        console.error('❌ No organization context')
        return c.json({ error: 'No organization context' }, 403)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema: { calendarEvents } })

      const tenantId = await getTenantId(c.env, organizationId)
      
      const [event] = await db
        .insert(calendarEvents)
        .values({
          ...data,
          tenantId,
          createdBy: user.id
        })
        .returning()
      
      console.log('✅ Calendar event created:', event.id)
      
      return c.json({ event })
    } catch (error) {
      console.error('❌ Create event error:', error)
      return c.json({ 
        error: 'Failed to create event', 
        details: error instanceof Error ? error.message : String(error) 
      }, 500)
    }
  }
)

/**
 * PATCH /api/v1/calendar/:eventId - Update event
 */
calendarApp.patch('/:eventId',
  zValidator('json', updateEventSchema),
  async (c) => {
    try {
      const { eventId } = c.req.param()
      const data = c.req.valid('json')
      const user = c.get('user')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema: { calendarEvents } })

      const tenantId = await getTenantId(c.env, organizationId)
      
      // Check ownership or admin
      const [existing] = await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, eventId),
            eq(calendarEvents.tenantId, tenantId)
          )
        )
      
      if (!existing) {
        return c.json({ error: 'Event not found' }, 404)
      }
      
      if (existing.createdBy !== user.id) {
        return c.json({ error: 'Not authorized' }, 403)
      }
      
      const [event] = await db
        .update(calendarEvents)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(calendarEvents.id, eventId))
        .returning()
      
      console.log('✅ Calendar event updated:', event.id)
      
      return c.json({ event })
    } catch (error) {
      console.error('❌ Update event error:', error)
      return c.json({ error: 'Failed to update event' }, 500)
    }
  }
)

/**
 * DELETE /api/v1/calendar/:eventId - Delete event
 */
calendarApp.delete('/:eventId', async (c) => {
  try {
    const { eventId } = c.req.param()
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { calendarEvents } })

    const tenantId = await getTenantId(c.env, organizationId)
    
    // Check ownership
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.tenantId, tenantId)
        )
      )
    
    if (!existing) {
      return c.json({ error: 'Event not found' }, 404)
    }
    
    if (existing.createdBy !== user.id) {
      return c.json({ error: 'Not authorized' }, 403)
    }
    
    await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.id, eventId))
    
    console.log('✅ Calendar event deleted:', eventId)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete event error:', error)
    return c.json({ error: 'Failed to delete event' }, 500)
  }
})

/**
 * POST /api/v1/calendar/:eventId/cancel - Cancel event (soft delete)
 */
calendarApp.post('/:eventId/cancel', async (c) => {
  try {
    const { eventId } = c.req.param()
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { calendarEvents } })

    const tenantId = await getTenantId(c.env, organizationId)
    
    const [event] = await db
      .update(calendarEvents)
      .set({ cancelled: true, updatedAt: new Date() })
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.tenantId, tenantId),
          eq(calendarEvents.createdBy, user.id)
        )
      )
      .returning()
    
    if (!event) {
      return c.json({ error: 'Event not found or not authorized' }, 404)
    }
    
    console.log('✅ Calendar event cancelled:', eventId)
    
    return c.json({ event })
  } catch (error) {
    console.error('❌ Cancel event error:', error)
    return c.json({ error: 'Failed to cancel event' }, 500)
  }
})

// ============================================
// RSVP
// ============================================

/**
 * POST /api/v1/calendar/:eventId/rsvp - RSVP to event
 */
calendarApp.post('/:eventId/rsvp',
  zValidator('json', z.object({
    response: z.enum(['yes', 'no', 'maybe'])
  })),
  async (c) => {
    try {
      const { eventId } = c.req.param()
      const { response } = c.req.valid('json')
      const user = c.get('user')
      const organizationId = c.get('organizationId')

      if (!organizationId) {
        return c.json({ error: 'No organization context' }, 403)
      }

      const sqlClient = neon(c.env.DATABASE_URL)
      const db = drizzle(sqlClient, { schema: { calendarEvents, eventRsvps } })

      const tenantId = await getTenantId(c.env, organizationId)
      
      // Check if event exists
      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, eventId),
            eq(calendarEvents.tenantId, tenantId)
          )
        )
      
      if (!event) {
        return c.json({ error: 'Event not found' }, 404)
      }
      
      // Upsert RSVP
      const [existing] = await db
        .select()
        .from(eventRsvps)
        .where(
          and(
            eq(eventRsvps.eventId, eventId),
            eq(eventRsvps.userId, user.id)
          )
        )
      
      let rsvp
      
      if (existing) {
        [rsvp] = await db
          .update(eventRsvps)
          .set({ response, updatedAt: new Date() })
          .where(eq(eventRsvps.id, existing.id))
          .returning()
      } else {
        [rsvp] = await db
          .insert(eventRsvps)
          .values({
            eventId,
            userId: user.id,
            tenantId,
            response
          })
          .returning()
      }
      
      console.log('✅ RSVP saved:', rsvp.id)
      
      return c.json({ rsvp })
    } catch (error) {
      console.error('❌ RSVP error:', error)
      return c.json({ error: 'Failed to save RSVP' }, 500)
    }
  }
)

/**
 * GET /api/v1/calendar/:eventId/rsvps - Get event RSVPs
 */
calendarApp.get('/:eventId/rsvps', async (c) => {
  try {
    const { eventId } = c.req.param()
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { eventRsvps } })

    const tenantId = await getTenantId(c.env, organizationId)
    
    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.tenantId, tenantId)
        )
      )
    
    // Group by response
    const summary = {
      yes: rsvps.filter(r => r.response === 'yes').length,
      no: rsvps.filter(r => r.response === 'no').length,
      maybe: rsvps.filter(r => r.response === 'maybe').length,
      total: rsvps.length
    }
    
    return c.json({ rsvps, summary })
  } catch (error) {
    console.error('❌ Get RSVPs error:', error)
    return c.json({ error: 'Failed to fetch RSVPs' }, 500)
  }
})

export default calendarApp

