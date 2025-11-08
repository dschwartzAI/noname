import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../../../database/better-auth-schema';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../index';

const godApp = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Apply auth middleware
godApp.use('*', requireAuth);

// Middleware: Check if user is God
godApp.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user.isGod) {
    return c.json({ error: 'Unauthorized: God access required' }, 403);
  }
  await next();
});

// GET /api/god/organizations - List all organizations with stats
godApp.get('/organizations', async (c) => {
  try {
    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get organizations with member count and owner info
    const orgs = await db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        logo: schema.organization.logo,
        metadata: schema.organization.metadata,
        createdAt: schema.organization.createdAt,
        memberCount: count(schema.member.id),
        // Get owner info via subquery
        ownerName: sql<string>`(
          SELECT u.name
          FROM ${schema.member} m
          INNER JOIN ${schema.user} u ON m.user_id = u.id
          WHERE m.organization_id = ${schema.organization.id}
          AND m.role = 'owner'
          LIMIT 1
        )`,
        ownerEmail: sql<string>`(
          SELECT u.email
          FROM ${schema.member} m
          INNER JOIN ${schema.user} u ON m.user_id = u.id
          WHERE m.organization_id = ${schema.organization.id}
          AND m.role = 'owner'
          LIMIT 1
        )`,
      })
      .from(schema.organization)
      .leftJoin(schema.member, eq(schema.organization.id, schema.member.organizationId))
      .groupBy(schema.organization.id)
      .orderBy(schema.organization.createdAt);

    // Parse metadata and extract program name and status
    const orgsWithMeta = orgs.map((org) => {
      const metadata = org.metadata ? JSON.parse(org.metadata) : null;
      const programName = metadata?.branding?.companyName || org.name;
      const status = metadata?.status || 'active'; // Default to 'active' if not set

      return {
        id: org.id,
        ownerName: org.ownerName,
        ownerEmail: org.ownerEmail,
        programName,
        slug: org.slug,
        logo: org.logo,
        memberCount: org.memberCount,
        createdAt: org.createdAt,
        status,
      };
    });

    return c.json({ organizations: orgsWithMeta });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to fetch organizations' }, 500);
  }
});

// POST /api/god/organizations - Create test organization
godApp.post('/organizations', async (c) => {
  try {
    const { name, slug } = await c.req.json();
    const user = c.get('user');

    if (!name || !slug) {
      return c.json({ error: 'Name and slug are required' }, 400);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Create organization
    const orgId = nanoid();
    await db.insert(schema.organization).values({
      id: orgId,
      name,
      slug,
      logo: null,
      metadata: JSON.stringify({ tier: 'free' }),
      createdAt: new Date(),
    });

    // Add creator as owner
    await db.insert(schema.member).values({
      id: nanoid(),
      organizationId: orgId,
      userId: user.id,
      role: 'owner',
      createdAt: new Date(),
    });

    return c.json({ message: 'Organization created', organizationId: orgId }, 201);
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to create organization' }, 500);
  }
});

// GET /api/god/stats - System-wide statistics
godApp.get('/stats', async (c) => {
  try {
    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    const [userCount] = await db.select({ count: count() }).from(schema.user);
    const [ownerCount] = await db
      .select({ count: count() })
      .from(schema.member)
      .where(eq(schema.member.role, 'owner'));

    return c.json({
      totalUsers: userCount.count,
      totalOwners: ownerCount.count,
    });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// PATCH /api/god/organizations/:id/status - Toggle organization status (active/suspended)
godApp.patch('/organizations/:id/status', async (c) => {
  try {
    const orgId = c.req.param('id');
    const { status } = await c.req.json();

    if (!status || !['active', 'suspended'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be "active" or "suspended"' }, 400);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get current org
    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId));

    if (!org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Update metadata with new status
    const metadata = org.metadata ? JSON.parse(org.metadata) : {};
    metadata.status = status;

    await db
      .update(schema.organization)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(schema.organization.id, orgId));

    return c.json({ message: 'Status updated', status });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// DELETE /api/god/organizations/:id - Delete organization and all associated data
godApp.delete('/organizations/:id', async (c) => {
  try {
    const orgId = c.req.param('id');

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Check if org exists
    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId));

    if (!org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Delete organization (cascade will delete members)
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.id, orgId));

    return c.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to delete organization' }, 500);
  }
});

export { godApp };
