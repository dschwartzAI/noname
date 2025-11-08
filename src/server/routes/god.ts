import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../../../database/better-auth-schema';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../index';
import { sendOwnerInviteEmail } from '../lib/email';

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

    // Count all members, excluding those in deleted organizations
    const allMembers = await db
      .select({
        memberId: schema.member.id,
        role: schema.member.role,
        orgMetadata: schema.organization.metadata,
      })
      .from(schema.member)
      .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id));

    // Filter out members from deleted organizations
    const activeMembers = allMembers.filter((member) => {
      const metadata = member.orgMetadata ? JSON.parse(member.orgMetadata) : {};
      return metadata.status !== 'deleted';
    });

    const totalMemberCount = activeMembers.length;
    const activeOwnerCount = activeMembers.filter(m => m.role === 'owner').length;

    return c.json({
      totalMembers: totalMemberCount,
      totalOwners: activeOwnerCount,
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

// DELETE /api/god/organizations/:id - Soft delete organization (set status to "deleted")
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

    // Soft delete: Update metadata with deleted status and timestamp
    const metadata = org.metadata ? JSON.parse(org.metadata) : {};
    metadata.status = 'deleted';
    metadata.deletedAt = new Date().toISOString();

    await db
      .update(schema.organization)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(schema.organization.id, orgId));

    return c.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to delete organization' }, 500);
  }
});

// POST /api/god/invites - Create owner invite and send email
godApp.post('/invites', async (c) => {
  try {
    const { email, organizationPreset } = await c.req.json();
    const user = c.get('user');

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Generate unique token
    const token = nanoid(32);
    const inviteId = nanoid();

    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite in database
    await db.insert(schema.ownerInvite).values({
      id: inviteId,
      email,
      token,
      organizationPreset: organizationPreset ? JSON.stringify(organizationPreset) : null,
      expiresAt,
      usedAt: null,
      createdBy: user.id,
      createdAt: new Date(),
    });

    // Send invite email
    const emailResult = await sendOwnerInviteEmail(
      {
        to: email,
        inviterName: user.name || user.email,
        inviteToken: token,
        appUrl: c.env.APP_URL || 'http://localhost:5174',
      },
      c.env.RESEND_API_KEY
    );

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);

      // Check if it's a Resend validation error (test mode restriction)
      const isResendTestModeError = emailResult.error?.includes('testing emails') ||
                                    emailResult.error?.includes('validation_error');

      if (isResendTestModeError) {
        return c.json({
          error: 'Email sending restricted in test mode',
          details: 'Resend test API can only send to your verified email. To send to any email, verify a domain in Resend or use your verified email for testing.'
        }, 400);
      }

      return c.json({ error: 'Failed to send invite email', details: emailResult.error }, 500);
    }

    return c.json({
      message: 'Invite sent successfully',
      invite: {
        id: inviteId,
        email,
        token,
        expiresAt,
      },
    }, 201);
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to create invite' }, 500);
  }
});

// GET /api/god/invites - List all owner invites
godApp.get('/invites', async (c) => {
  try {
    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get all invites with creator info
    const invites = await db
      .select({
        id: schema.ownerInvite.id,
        email: schema.ownerInvite.email,
        token: schema.ownerInvite.token,
        organizationPreset: schema.ownerInvite.organizationPreset,
        expiresAt: schema.ownerInvite.expiresAt,
        usedAt: schema.ownerInvite.usedAt,
        createdAt: schema.ownerInvite.createdAt,
        createdByName: schema.user.name,
        createdByEmail: schema.user.email,
      })
      .from(schema.ownerInvite)
      .leftJoin(schema.user, eq(schema.ownerInvite.createdBy, schema.user.id))
      .orderBy(sql`${schema.ownerInvite.createdAt} DESC`);

    // Parse organization presets and determine status
    const invitesWithStatus = invites.map((invite) => {
      const now = new Date();
      let status: 'pending' | 'used' | 'expired' = 'pending';

      if (invite.usedAt) {
        status = 'used';
      } else if (invite.expiresAt < now) {
        status = 'expired';
      }

      return {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        organizationPreset: invite.organizationPreset
          ? JSON.parse(invite.organizationPreset)
          : null,
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        createdAt: invite.createdAt,
        createdBy: {
          name: invite.createdByName,
          email: invite.createdByEmail,
        },
        status,
      };
    });

    return c.json({ invites: invitesWithStatus });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to fetch invites' }, 500);
  }
});

// POST /api/god/invites/:id/resend - Resend invite email
godApp.post('/invites/:id/resend', async (c) => {
  try {
    const inviteId = c.req.param('id');
    const user = c.get('user');

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get invite
    const [invite] = await db
      .select()
      .from(schema.ownerInvite)
      .where(eq(schema.ownerInvite.id, inviteId));

    if (!invite) {
      return c.json({ error: 'Invite not found' }, 404);
    }

    // Check if already used
    if (invite.usedAt) {
      return c.json({ error: 'Cannot resend used invite' }, 400);
    }

    // Check if expired
    const now = new Date();
    if (invite.expiresAt < now) {
      return c.json({ error: 'Invite has expired. Create a new invite instead.' }, 400);
    }

    // Resend email
    const emailResult = await sendOwnerInviteEmail(
      {
        to: invite.email,
        inviterName: user.name || user.email,
        inviteToken: invite.token,
        appUrl: c.env.APP_URL || 'http://localhost:5174',
      },
      c.env.RESEND_API_KEY
    );

    if (!emailResult.success) {
      console.error('Failed to resend invite email:', emailResult.error);
      return c.json({ error: 'Failed to resend invite email', details: emailResult.error }, 500);
    }

    return c.json({ message: 'Invite resent successfully' });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to resend invite' }, 500);
  }
});

// DELETE /api/god/invites/:id - Revoke/delete invite
godApp.delete('/invites/:id', async (c) => {
  try {
    const inviteId = c.req.param('id');

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Check if invite exists
    const [invite] = await db
      .select()
      .from(schema.ownerInvite)
      .where(eq(schema.ownerInvite.id, inviteId));

    if (!invite) {
      return c.json({ error: 'Invite not found' }, 404);
    }

    // Prevent deleting used invites (for audit trail)
    if (invite.usedAt) {
      return c.json({ error: 'Cannot delete used invite. It will remain for audit purposes.' }, 400);
    }

    // Delete invite
    await db
      .delete(schema.ownerInvite)
      .where(eq(schema.ownerInvite.id, inviteId));

    return c.json({ message: 'Invite revoked successfully' });
  } catch (error) {
    console.error('God API error:', error);
    return c.json({ error: 'Failed to revoke invite' }, 500);
  }
});

export { godApp };
