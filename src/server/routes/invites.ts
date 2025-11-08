import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../../../database/better-auth-schema';
import type { Env } from '../index';

const invitesApp = new Hono<{ Bindings: Env }>();

// GET /api/invites/:token - Validate and get invite details (public endpoint)
invitesApp.get('/:token', async (c) => {
  try {
    const token = c.req.param('token');

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Find invite by token
    const [invite] = await db
      .select({
        id: schema.ownerInvite.id,
        email: schema.ownerInvite.email,
        token: schema.ownerInvite.token,
        expiresAt: schema.ownerInvite.expiresAt,
        usedAt: schema.ownerInvite.usedAt,
        organizationPreset: schema.ownerInvite.organizationPreset,
      })
      .from(schema.ownerInvite)
      .where(eq(schema.ownerInvite.token, token));

    if (!invite) {
      return c.json({ error: 'Invalid invite token' }, 404);
    }

    // Check if already used
    if (invite.usedAt) {
      return c.json({ error: 'This invite has already been used' }, 400);
    }

    // Check if expired
    const now = new Date();
    if (invite.expiresAt < now) {
      return c.json({ error: 'This invite has expired' }, 400);
    }

    // Return invite details (without sensitive data like full token)
    return c.json({
      email: invite.email,
      organizationPreset: invite.organizationPreset
        ? JSON.parse(invite.organizationPreset)
        : null,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Invite validation error:', error);
    return c.json({ error: 'Failed to validate invite' }, 500);
  }
});

// POST /api/invites/:token/accept - Accept invite and create owner account
invitesApp.post('/:token/accept', async (c) => {
  try {
    const token = c.req.param('token');
    const { name, password, programName } = await c.req.json();

    if (!token || !name || !password || !programName) {
      return c.json(
        { error: 'Token, name, password, and program name are required' },
        400
      );
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Validate invite
    const [invite] = await db
      .select()
      .from(schema.ownerInvite)
      .where(eq(schema.ownerInvite.token, token));

    if (!invite) {
      return c.json({ error: 'Invalid invite token' }, 404);
    }

    if (invite.usedAt) {
      return c.json({ error: 'This invite has already been used' }, 400);
    }

    const now = new Date();
    if (invite.expiresAt < now) {
      return c.json({ error: 'This invite has expired' }, 400);
    }

    // Check if user already exists with this email
    const [existingUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, invite.email));

    if (existingUser) {
      return c.json({ error: 'An account with this email already exists' }, 400);
    }

    // Create user via Better Auth signup endpoint
    // Note: Better Auth is mounted at /api/auth/*
    const signupResponse = await fetch(`${c.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: invite.email,
        password,
        name,
      }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      return c.json(
        { error: error.message || 'Failed to create account' },
        signupResponse.status
      );
    }

    const userData = await signupResponse.json();

    // Get the newly created user
    const [newUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, invite.email));

    if (!newUser) {
      return c.json({ error: 'User creation failed' }, 500);
    }

    // Note: Invited owners are regular owners, NOT God users
    // Only the platform admin (dschwartz06@gmail.com) should be God

    // Create organization for the owner
    const orgId = nanoid();
    const slug = programName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    await db.insert(schema.organization).values({
      id: orgId,
      name: programName,
      slug: `${slug}-${Date.now()}`, // Ensure uniqueness
      logo: null,
      metadata: JSON.stringify({
        tier: 'free',
        status: 'active',
      }),
      createdAt: new Date(),
    });

    // Add user as owner of the organization
    await db.insert(schema.member).values({
      id: nanoid(),
      organizationId: orgId,
      userId: newUser.id,
      role: 'owner',
      createdAt: new Date(),
    });

    // Mark invite as used
    await db
      .update(schema.ownerInvite)
      .set({ usedAt: new Date() })
      .where(eq(schema.ownerInvite.id, invite.id));

    return c.json({
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      organization: {
        id: orgId,
        name: programName,
        slug,
      },
    }, 201);
  } catch (error) {
    console.error('Invite acceptance error:', error);
    return c.json({ error: 'Failed to accept invite' }, 500);
  }
});

export default invitesApp;
