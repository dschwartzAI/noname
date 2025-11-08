/**
 * Courses API Routes
 * 
 * Handles course, module, and lesson management for the Syndicate LMS
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/database/neon-db';
import { 
  courses, modules, lessons, 
  courseEnrollments, lessonProgress,
  type SelectCourse, type SelectModule, type SelectLesson
} from '@/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const app = new Hono();

// ============================================
// COURSES
// ============================================

// Get all courses
app.get('/', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const allCourses = await db
    .select({
      course: courses,
      moduleCount: sql<number>`count(distinct ${modules.id})`,
      lessonCount: sql<number>`count(${lessons.id})`,
      isEnrolled: sql<boolean>`exists(
        select 1 from ${courseEnrollments}
        where ${courseEnrollments.courseId} = ${courses.id}
        and ${courseEnrollments.userId} = ${userId}
      )`,
      progress: sql<number>`coalesce(
        (select ${courseEnrollments.progressPercentage}
         from ${courseEnrollments}
         where ${courseEnrollments.courseId} = ${courses.id}
         and ${courseEnrollments.userId} = ${userId}
        ), 0
      )`
    })
    .from(courses)
    .leftJoin(modules, eq(modules.courseId, courses.id))
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(courses.tenantId, tenantId),
        eq(courses.published, true)
      )
    )
    .groupBy(courses.id)
    .orderBy(courses.order);
  
  return c.json({ courses: allCourses });
});

// Get single course with modules and lessons
app.get('/:courseId', async (c) => {
  const { courseId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        eq(courses.tenantId, tenantId)
      )
    );
  
  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }
  
  // Get modules with lessons
  const courseModules = await db.query.modules.findMany({
    where: eq(modules.courseId, courseId),
    orderBy: [modules.order],
    with: {
      lessons: {
        orderBy: [lessons.order]
      }
    }
  });
  
  // Get enrollment
  const [enrollment] = await db
    .select()
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.userId, userId)
      )
    );
  
  return c.json({
    course,
    modules: courseModules,
    enrollment
  });
});

// Enroll in course
app.post('/:courseId/enroll', async (c) => {
  const { courseId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.userId, userId)
      )
    );
  
  if (existing) {
    return c.json({ enrollment: existing });
  }
  
  // Create enrollment
  const [enrollment] = await db
    .insert(courseEnrollments)
    .values({
      tenantId,
      userId,
      courseId,
      completedLessons: [],
      progressPercentage: 0
    })
    .returning();
  
  // Update enrollment count
  await db
    .update(courses)
    .set({
      enrollmentCount: sql`${courses.enrollmentCount} + 1`
    })
    .where(eq(courses.id, courseId));
  
  return c.json({ enrollment });
});

// Update course progress
app.post('/:courseId/progress', 
  zValidator('json', z.object({
    lastAccessedLessonId: z.string().uuid()
  })),
  async (c) => {
    const { courseId } = c.req.param();
    const { lastAccessedLessonId } = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    await db
      .update(courseEnrollments)
      .set({
        lastAccessedLessonId,
        lastAccessedAt: new Date()
      })
      .where(
        and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, userId)
        )
      );
    
    return c.json({ success: true });
  }
);

// ============================================
// LESSONS
// ============================================

// Get lesson details
app.get('/lessons/:lessonId', async (c) => {
  const { lessonId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.tenantId, tenantId)
      )
    );
  
  if (!lesson) {
    return c.json({ error: 'Lesson not found' }, 404);
  }
  
  // Get progress
  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.userId, userId)
      )
    );
  
  return c.json({ lesson, progress });
});

// Update lesson progress
app.post('/lessons/:lessonId/progress',
  zValidator('json', z.object({
    watchTimeSeconds: z.number().optional(),
    lastWatchPosition: z.number().optional(),
    completed: z.boolean().optional()
  })),
  async (c) => {
    const { lessonId } = c.req.param();
    const data = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    
    // Get or create progress record
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.lessonId, lessonId),
          eq(lessonProgress.userId, userId)
        )
      );
    
    let progress;
    
    if (existing) {
      [progress] = await db
        .update(lessonProgress)
        .set({
          ...data,
          completedAt: data.completed ? new Date() : existing.completedAt,
          updatedAt: new Date()
        })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
    } else {
      [progress] = await db
        .insert(lessonProgress)
        .values({
          tenantId,
          userId,
          lessonId,
          ...data,
          completedAt: data.completed ? new Date() : null
        })
        .returning();
    }
    
    // If completed, update course enrollment
    if (data.completed) {
      // Get the lesson's module and course
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, lessonId));
      
      if (lesson) {
        const [module] = await db
          .select()
          .from(modules)
          .where(eq(modules.id, lesson.moduleId));
        
        if (module) {
          // Get enrollment
          const [enrollment] = await db
            .select()
            .from(courseEnrollments)
            .where(
              and(
                eq(courseEnrollments.courseId, module.courseId),
                eq(courseEnrollments.userId, userId)
              )
            );
          
          if (enrollment) {
            const completedLessons = [...enrollment.completedLessons, lessonId];
            
            // Calculate progress percentage
            const totalLessons = await db
              .select({ count: sql<number>`count(*)` })
              .from(lessons)
              .innerJoin(modules, eq(modules.id, lessons.moduleId))
              .where(eq(modules.courseId, module.courseId));
            
            const progressPercentage = Math.round(
              (completedLessons.length / totalLessons[0].count) * 100
            );
            
            await db
              .update(courseEnrollments)
              .set({
                completedLessons,
                progressPercentage,
                completedAt: progressPercentage === 100 ? new Date() : null
              })
              .where(eq(courseEnrollments.id, enrollment.id));
          }
        }
      }
    }
    
    return c.json({ progress });
  }
);

// Mark lesson as complete
app.post('/lessons/:lessonId/complete', async (c) => {
  const { lessonId } = c.req.param();
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  
  return app.fetch(
    new Request(`${c.req.url}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true })
    })
  );
});

export default app;


