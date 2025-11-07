import type { Context, Next } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../../../database/better-auth-schema';

export async function injectOrganization(c: Context, next: Next) {
  try {
    const user = c.get('user');

    if (!user) {
      // No user, skip organization context
      await next();
      return;
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // TODO: Get activeOrganizationId from session
    // For now, get user's first organization
    let membership = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, user.id))
      .limit(1)
      .then(rows => rows[0]);

    // If no membership exists, auto-create a default organization
    // This is a developer convenience to allow immediate chat usage for new users
    // Production tenants should still use explicit organization creation flows
    if (!membership) {
      try {
        const orgId = crypto.randomUUID();
        const memberId = crypto.randomUUID();
        const orgSlug = `${user.name?.toLowerCase().replace(/\s+/g, '-') || 'user'}-${Date.now()}`;
        const orgName = user.name ? `${user.name}'s Organization` : 'My Organization';

        // Create organization
        await db.insert(schema.organization).values({
          id: orgId,
          name: orgName,
          slug: orgSlug,
          logo: null,
          metadata: null,
        });

        // Create membership
        await db.insert(schema.member).values({
          id: memberId,
          organizationId: orgId,
          userId: user.id,
          role: 'owner',
          tierId: null,
        });

        membership = {
          id: memberId,
          organizationId: orgId,
          userId: user.id,
          role: 'owner',
          tierId: null,
          createdAt: new Date(),
        };

        console.log(`Auto-created default organization for user ${user.id}: ${orgId}`);
      } catch (createError) {
        console.error('Failed to auto-create organization:', createError);

        // Dev-mode fallback: Use user ID as temporary org ID if creation fails
        // This ensures chat works even if DB write fails during development
        if (c.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'development') {
          console.warn(`Dev mode: Using user ID as temporary organization ID for user ${user.id}`);
          c.set('organizationId', user.id);
          c.set('organizationRole', 'owner');
          await next();
          return;
        }

        // In production, fail without organization context
        throw createError;
      }
    }

    if (membership) {
      c.set('organizationId', membership.organizationId);
      c.set('organizationRole', membership.role);
    }

    await next();
  } catch (error) {
    console.error('Organization middleware error:', error);
    // Continue without organization context
    await next();
  }
}
