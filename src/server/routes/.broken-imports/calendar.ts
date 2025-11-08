/**
 * Calendar API Routes
 * 
 * Handles calendar events for the Syndicate LMS
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/database/neon-db';
import { calendarEvents, eventRsvps } from '@/database/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

const app = new Hono();

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['meeting', 'class', 'deadline', 'event', 'office_hours']).default('event'),
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  attendees: z.array(z.object({
    userId: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    rsvp: z.enum(['yes', 'no', 'maybe']).optional()
  })).default([]),
  recurring: z.boolean().default(false),
  recurrenceRule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number(),
    until: z.string().optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional()
  }).optional(),
  reminders: z.array(z.object({
    type: z.enum(['email', 'notification']),
    minutesBefore: z.number()
  })).default([]),
  color: z.string().default('#3b82f6'),
  category: z.string().optional(),
  visibility: z.enum(['public', 'private', 'organization']).default('organization')
});

const updateEventSchema = createEventSchema.partial();

// ============================================
// EVENTS
// ============================================

// Get events for a date range
app.get('/', 
  zValidator('query', z.object({
    startDate: z.string(),
    endDate: z.string(),
    type: z.enum(['meeting', 'class', 'deadline', 'event', 'office_hours']).optional(),
    category: z.string().optional()
  })),
  async (c) => {
    const { startDate, endDate, type, category } = c.req.valid('query');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    const conditions = [
      eq(calendarEvents.tenantId, tenantId),
      eq(calendarEvents.cancelled, false),
      gte(calendarEvents.endTime, new Date(startDate)),
      lte(calendarEvents.startTime, new Date(endDate))
    ];
    
    if (type) {
      conditions.push(eq(calendarEvents.type, type));
    }
    
    if (category) {
      conditions.push(eq(calendarEvents.category, category));
    }
    
    // Get events with RSVP status
    const events = await db
      .select({
        event: calendarEvents,
        userRsvp: sql<string | null>`(
          select ${eventRsvps.response}
          from ${eventRsvps}
          where ${eventRsvps.eventId} = ${calendarEvents.id}
          and ${eventRsvps.userId} = ${userId}
        )`
      })
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(calendarEvents.startTime);
    
    return c.json({ events });
  }
);

// Get single event
app.get('/:eventId', async (c) => {
  const { eventId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const [event] = await db
    .select({
      event: calendarEvents,
      userRsvp: sql<string | null>`(
        select ${eventRsvps.response}
        from ${eventRsvps}
        where ${eventRsvps.eventId} = ${calendarEvents.id}
        and ${eventRsvps.userId} = ${userId}
      )`
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.tenantId, tenantId)
      )
    );
  
  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }
  
  // Get all RSVPs
  const rsvps = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));
  
  return c.json({ ...event, rsvps });
});

// Create event
app.post('/',
  zValidator('json', createEventSchema),
  async (c) => {
    const data = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    const [event] = await db
      .insert(calendarEvents)
      .values({
        ...data,
        tenantId,
        createdBy: userId
      })
      .returning();
    
    return c.json({ event });
  }
);

// Update event
app.patch('/:eventId',
  zValidator('json', updateEventSchema),
  async (c) => {
    const { eventId } = c.req.param();
    const data = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    // Check ownership or admin
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.tenantId, tenantId)
        )
      );
    
    if (!existing) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    if (existing.createdBy !== userId) {
      return c.json({ error: 'Not authorized' }, 403);
    }
    
    const [event] = await db
      .update(calendarEvents)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(calendarEvents.id, eventId))
      .returning();
    
    return c.json({ event });
  }
);

// Delete event
app.delete('/:eventId', async (c) => {
  const { eventId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  // Check ownership
  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.tenantId, tenantId)
      )
    );
  
  if (!existing) {
    return c.json({ error: 'Event not found' }, 404);
  }
  
  if (existing.createdBy !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }
  
  await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, eventId));
  
  return c.json({ success: true });
});

// Cancel event (soft delete)
app.post('/:eventId/cancel', async (c) => {
  const { eventId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const [event] = await db
    .update(calendarEvents)
    .set({ cancelled: true, updatedAt: new Date() })
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.tenantId, tenantId),
        eq(calendarEvents.createdBy, userId)
      )
    )
    .returning();
  
  if (!event) {
    return c.json({ error: 'Event not found or not authorized' }, 404);
  }
  
  return c.json({ event });
});

// ============================================
// RSVP
// ============================================

// RSVP to event
app.post('/:eventId/rsvp',
  zValidator('json', z.object({
    response: z.enum(['yes', 'no', 'maybe'])
  })),
  async (c) => {
    const { eventId } = c.req.param();
    const { response } = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    // Check if event exists
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.tenantId, tenantId)
        )
      );
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // Upsert RSVP
    const [existing] = await db
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.userId, userId)
        )
      );
    
    let rsvp;
    
    if (existing) {
      [rsvp] = await db
        .update(eventRsvps)
        .set({ response, updatedAt: new Date() })
        .where(eq(eventRsvps.id, existing.id))
        .returning();
    } else {
      [rsvp] = await db
        .insert(eventRsvps)
        .values({
          eventId,
          userId,
          tenantId,
          response
        })
        .returning();
    }
    
    return c.json({ rsvp });
  }
);

// Get event RSVPs
app.get('/:eventId/rsvps', async (c) => {
  const { eventId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  
  const rsvps = await db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.tenantId, tenantId)
      )
    );
  
  // Group by response
  const summary = {
    yes: rsvps.filter(r => r.response === 'yes').length,
    no: rsvps.filter(r => r.response === 'no').length,
    maybe: rsvps.filter(r => r.response === 'maybe').length,
    total: rsvps.length
  };
  
  return c.json({ rsvps, summary });
});

export default app;


