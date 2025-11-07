import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../../../database/better-auth-schema';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../index';

const orgApp = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Apply auth middleware
orgApp.use('*', requireAuth);

// GET /api/organization/current - Get user's active organization
orgApp.get('/current', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get user's first organization (TODO: use activeOrganizationId from session)
    const [membership] = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, user.id))
      .limit(1);

    if (!membership) {
      return c.json({ organization: null });
    }

    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, membership.organizationId))
      .limit(1);

    return c.json({
      organization: {
        ...org,
        metadata: org.metadata ? JSON.parse(org.metadata) : null,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('Organization API error:', error);
    return c.json({ error: 'Failed to fetch organization' }, 500);
  }
});

// GET /api/organization/:id/members - List organization members
orgApp.get('/:id/members', async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('id');

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Verify user is member of this org
    const [membership] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, orgId), eq(schema.member.userId, user.id)))
      .limit(1);

    if (!membership) {
      return c.json({ error: 'Not a member of this organization' }, 403);
    }

    // Get all members with user details
    const members = await db
      .select({
        id: schema.member.id,
        role: schema.member.role,
        createdAt: schema.member.createdAt,
        userId: schema.user.id,
        userName: schema.user.name,
        userEmail: schema.user.email,
        userImage: schema.user.image,
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.member.organizationId, orgId));

    return c.json({ members });
  } catch (error) {
    console.error('Organization API error:', error);
    return c.json({ error: 'Failed to fetch members' }, 500);
  }
});

// PATCH /api/organization/:id - Update organization (owner only)
orgApp.patch('/:id', async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('id');
    const updates = await c.req.json();

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Verify user is owner
    const [membership] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, orgId), eq(schema.member.userId, user.id)))
      .limit(1);

    if (!membership || membership.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    // Build update object
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.logo !== undefined) updateData.logo = updates.logo;
    if (updates.favicon !== undefined) updateData.favicon = updates.favicon;
    if (updates.metadata) {
      // Merge with existing metadata
      const [currentOrg] = await db.select().from(schema.organization).where(eq(schema.organization.id, orgId)).limit(1);
      const existingMetadata = currentOrg.metadata ? JSON.parse(currentOrg.metadata) : {};
      updateData.metadata = JSON.stringify({ ...existingMetadata, ...updates.metadata });
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ message: 'No updates provided' });
    }

    await db.update(schema.organization).set(updateData).where(eq(schema.organization.id, orgId));

    return c.json({ message: 'Organization updated' });
  } catch (error) {
    console.error('Organization API error:', error);
    return c.json({ error: 'Failed to update organization' }, 500);
  }
});

// DELETE /api/organization/:id/members/:userId - Remove member
orgApp.delete('/:id/members/:userId', async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('id');
    const targetUserId = c.req.param('userId');

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Verify user is owner/admin
    const [membership] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, orgId), eq(schema.member.userId, user.id)))
      .limit(1);

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return c.json({ error: 'Owner or admin access required' }, 403);
    }

    // Remove member
    await db.delete(schema.member).where(and(eq(schema.member.organizationId, orgId), eq(schema.member.userId, targetUserId)));

    return c.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Organization API error:', error);
    return c.json({ error: 'Failed to remove member' }, 500);
  }
});

export { orgApp };
