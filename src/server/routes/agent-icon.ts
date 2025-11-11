import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../../database/better-auth-schema';
import type { Env } from '../index';

const agentIconApp = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Apply auth middleware
agentIconApp.use('*', requireAuth);

// GET /api/agents/icon/:key - Serve icon from R2
agentIconApp.get('/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');

    if (!c.env.R2_ASSETS) {
      return c.json({ error: 'Storage not configured' }, 500);
    }

    const object = await c.env.R2_ASSETS.get(key);

    if (!object) {
      return c.notFound();
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Agent icon serve error:', error);
    return c.json({ error: 'Failed to serve icon' }, 500);
  }
});

// POST /api/agents/icon/upload - Upload agent icon to R2
agentIconApp.post('/upload', async (c) => {
  try {
    console.log('📤 Agent icon upload started');
    const user = c.get('user');
    if (!user) {
      console.error('❌ No user found');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    console.log('✅ User authenticated:', user.id);

    // Check if R2 bucket is available
    if (!c.env.R2_ASSETS) {
      console.error('❌ R2_ASSETS not available');
      return c.json({ error: 'Storage not configured' }, 500);
    }
    console.log('✅ R2_ASSETS binding available');

    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file in formData');
      return c.json({ error: 'No file provided' }, 400);
    }
    console.log('✅ File received:', file.name, file.size, 'bytes');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are allowed' }, 400);
    }

    // Validate file size (2MB max for agent icons)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: 'File size must be less than 2MB' }, 400);
    }

    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Get user's organization (verify they're an owner)
    const [membership] = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, user.id))
      .limit(1);

    if (!membership) {
      return c.json({ error: 'No organization found' }, 404);
    }

    if (membership.role !== 'owner') {
      return c.json({ error: 'Only owners can upload agent icons' }, 403);
    }

    // Generate unique filename with organization isolation
    // Pattern: {orgId}/agent-icons/{agentId}-{timestamp}.{ext}
    // Note: We use timestamp as agentId might not be known yet during creation
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}.${extension}`;
    const key = `${membership.organizationId}/agent-icons/${filename}`;
    console.log('📝 Generated key:', key);

    // Upload to R2
    console.log('⬆️ Uploading to R2...');
    const arrayBuffer = await file.arrayBuffer();
    console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength);

    await c.env.R2_ASSETS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    console.log('✅ R2 upload successful!');

    // Return Workers route URL (more secure than public R2.dev URL)
    // This serves through /api/agents/icon/[key]
    const publicUrl = `/api/agents/icon/${key}`;
    console.log('🔗 Generated public URL:', publicUrl);

    return c.json({ url: publicUrl });
  } catch (error) {
    console.error('Agent icon upload error:', error);
    return c.json({ error: 'Failed to upload icon' }, 500);
  }
});

export { agentIconApp };
