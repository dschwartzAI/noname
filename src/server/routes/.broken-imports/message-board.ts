/**
 * Message Board API Routes - Minimal, reusable implementation
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/database/neon-db';
import { boardCategories, boardThreads, boardReplies, boardLikes } from '@/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const app = new Hono();

// ============================================
// CATEGORIES
// ============================================

app.get('/categories', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const categories = await db.query.boardCategories.findMany({
    where: eq(boardCategories.tenantId, tenantId),
    orderBy: [boardCategories.order]
  });
  return c.json({ categories });
});

// ============================================
// THREADS
// ============================================

app.get('/threads', 
  zValidator('query', z.object({
    categoryId: z.string().uuid().optional(),
    sort: z.enum(['recent', 'popular']).default('recent')
  })),
  async (c) => {
    const { categoryId, sort } = c.req.valid('query');
    const tenantId = c.get('tenantId') as string;
    
    const conditions = [eq(boardThreads.tenantId, tenantId)];
    if (categoryId) conditions.push(eq(boardThreads.categoryId, categoryId));
    
    const threads = await db.query.boardThreads.findMany({
      where: and(...conditions),
      orderBy: sort === 'popular' ? [desc(boardThreads.likeCount)] : [desc(boardThreads.lastReplyAt)],
      limit: 50
    });
    
    return c.json({ threads });
  }
);

app.get('/threads/:threadId', async (c) => {
  const { threadId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  
  const thread = await db.query.boardThreads.findFirst({
    where: and(eq(boardThreads.id, threadId), eq(boardThreads.tenantId, tenantId))
  });
  
  if (!thread) return c.json({ error: 'Thread not found' }, 404);
  
  const replies = await db.query.boardReplies.findMany({
    where: eq(boardReplies.threadId, threadId),
    orderBy: [boardReplies.createdAt]
  });
  
  // Update view count
  await db.update(boardThreads).set({ viewCount: sql`${boardThreads.viewCount} + 1` }).where(eq(boardThreads.id, threadId));
  
  return c.json({ thread, replies });
});

app.post('/threads',
  zValidator('json', z.object({
    categoryId: z.string().uuid(),
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    tags: z.array(z.string()).default([])
  })),
  async (c) => {
    const data = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    const [thread] = await db.insert(boardThreads).values({ ...data, tenantId, authorId: userId }).returning();
    return c.json({ thread });
  }
);

// ============================================
// REPLIES
// ============================================

app.post('/threads/:threadId/replies',
  zValidator('json', z.object({
    content: z.string().min(1),
    parentReplyId: z.string().uuid().optional()
  })),
  async (c) => {
    const { threadId } = c.req.param();
    const data = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    const [reply] = await db.insert(boardReplies).values({ ...data, threadId, tenantId, authorId: userId }).returning();
    
    // Update thread stats
    await db.update(boardThreads).set({
      replyCount: sql`${boardThreads.replyCount} + 1`,
      lastReplyAt: new Date(),
      lastReplyBy: userId
    }).where(eq(boardThreads.id, threadId));
    
    return c.json({ reply });
  }
);

// ============================================
// LIKES
// ============================================

app.post('/threads/:threadId/like', async (c) => {
  const { threadId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const [like] = await db.insert(boardLikes).values({ threadId, userId, tenantId }).returning();
  await db.update(boardThreads).set({ likeCount: sql`${boardThreads.likeCount} + 1` }).where(eq(boardThreads.id, threadId));
  
  return c.json({ like });
});

app.delete('/threads/:threadId/like', async (c) => {
  const { threadId } = c.req.param();
  const userId = c.get('userId') as string;
  
  await db.delete(boardLikes).where(and(eq(boardLikes.threadId, threadId), eq(boardLikes.userId, userId)));
  await db.update(boardThreads).set({ likeCount: sql`${boardThreads.likeCount} - 1` }).where(eq(boardThreads.id, threadId));
  
  return c.json({ success: true });
});

export default app;


