import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../../database/better-auth-schema';
import type { Env } from '../index';

const logoApp = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Apply auth middleware
logoApp.use('*', requireAuth);

// GET /api/organization/logo/:key - Serve logo from R2
logoApp.get('/:key{.+}', async (c) => {
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
    console.error('Logo serve error:', error);
    return c.json({ error: 'Failed to serve logo' }, 500);
  }
});

// POST /api/organization/logo/upload - Upload logo to R2
logoApp.post('/upload', async (c) => {
  try {
    console.log('📤 Logo upload started');
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
    const type = (formData.get('type') as string) || 'logo'; // 'logo' or 'favicon'

    if (!file) {
      console.error('❌ No file in formData');
      return c.json({ error: 'No file provided' }, 400);
    }
    console.log('✅ File received:', file.name, file.size, 'bytes', 'type:', type);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are allowed' }, 400);
    }

    // Validate file size (5MB max for logos, 1MB for favicons)
    const maxSize = type === 'favicon' ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = type === 'favicon' ? '1MB' : '5MB';
      return c.json({ error: `File size must be less than ${maxSizeMB}` }, 400);
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
      return c.json({ error: 'Only owners can update the logo' }, 403);
    }

    // Generate unique filename with type-specific folder
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${membership.organizationId}-${timestamp}.${extension}`;
    const folder = type === 'favicon' ? 'favicons' : 'logos';
    const key = `${folder}/${filename}`;
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

    // Generate public URL for R2.dev subdomain
    // Format: https://pub-xxx.r2.dev/path (bucket is implicit in the subdomain)
    const r2PublicUrl = c.env.R2_PUBLIC_URL || 'https://pub-32b22141416d4061be1d3d39bd5f5e69.r2.dev';
    const publicUrl = `${r2PublicUrl}/${key}`;
    console.log('🔗 Generated public URL:', publicUrl);

    return c.json({ url: publicUrl });
  } catch (error) {
    console.error('Logo upload error:', error);
    return c.json({ error: 'Failed to upload logo' }, 500);
  }
});

export { logoApp };

