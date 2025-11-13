/**
 * Require Owner Middleware
 *
 * Ensures the authenticated user is an organization owner.
 * Must be used after requireAuth and injectOrganization middleware.
 */

import type { Context, Next } from 'hono';

export async function requireOwner(c: Context, next: Next) {
  const role = c.get('organizationRole');

  if (!role) {
    return c.json({ error: 'No organization context' }, 403);
  }

  if (role !== 'owner') {
    return c.json({
      error: 'Owner access required',
      message: 'This feature is only available to organization owners'
    }, 403);
  }

  await next();
}
