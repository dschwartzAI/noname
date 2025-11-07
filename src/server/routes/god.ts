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

    // Parse metadata and extract program name
    const orgsWithMeta = orgs.map((org) => {
      const metadata = org.metadata ? JSON.parse(org.metadata) : null;
      const programName = metadata?.branding?.companyName || org.name;

      return {
        id: org.id,
        ownerName: org.ownerName,
        ownerEmail: org.ownerEmail,
        programName,
        slug: org.slug,
        logo: org.logo,
        memberCount: org.memberCount,
        createdAt: org.createdAt,
        status: 'active', // TODO: Add status logic
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

export { godApp };
