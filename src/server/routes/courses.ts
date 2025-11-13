/**
 * Courses API Routes - LMS Course Management
 *
 * Handles course CRUD operations for the LMS system:
 * - List courses (with progress for enrolled users)
 * - Get course detail with modules and lessons
 * - Create/update/delete courses (Admin/Owner only)
 * - Manage modules and lessons
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import * as schema from '../../../database/schema'
import { courses, modules, lessons, courseEnrollments, lessonProgress } from '../../../database/schema/courses'
import { tenants } from '../../../database/schema/tenants'
import { instructors } from '../../../database/schema/instructors'
import type { Env } from '../index'

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    isGod: boolean
  }
  organizationId?: string
  organizationRole?: string
}

const coursesApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply auth middleware to all routes
coursesApp.use('*', requireAuth)
coursesApp.use('*', injectOrganization)

/**
 * GET /api/v1/courses/image/:key - Serve course image from R2
 */
coursesApp.get('/image/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key')

    if (!c.env.R2_ASSETS) {
      return c.json({ error: 'Storage not configured' }, 500)
    }

    const object = await c.env.R2_ASSETS.get(key)

    if (!object) {
      return c.notFound()
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('❌ Course image serve error:', error)
    return c.json({ error: 'Failed to serve image' }, 500)
  }
})

/**
 * POST /api/v1/courses/upload - Upload course image to R2
 */
coursesApp.post('/upload', async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can upload course images' }, 403)
    }

    if (!c.env.R2_ASSETS) {
      return c.json({ error: 'Storage not configured' }, 500)
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are allowed' }, 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size must be less than 5MB' }, 400)
    }

    const tenantId = await getTenantId(c.env, organizationId)

    const extension = file.name.split('.').pop() || 'png'
    const key = `courses/${tenantId}/${crypto.randomUUID()}.${extension}`

    const arrayBuffer = await file.arrayBuffer()

    await c.env.R2_ASSETS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    })

    // Use Workers route instead of R2 public URL for instant availability
    const url = `/api/v1/courses/image/${key}`

    console.log('✅ Course image uploaded:', { key, url })

    return c.json({ url })
  } catch (error) {
    console.error('❌ Course image upload error:', error)
    return c.json({ error: 'Failed to upload course image' }, 500)
  }
})

// Debug logging
coursesApp.use('*', async (c, next) => {
  console.log('🔍 Courses route hit:', c.req.method, c.req.path)
  await next()
})

/**
 * Helper: Get or create tenant for organization
 * Creates a tenant if one doesn't exist for the organization
 */
async function getTenantId(env: Env, organizationId: string): Promise<string> {
  try {
    const sqlClient = neon(env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { tenants } })
    
    // For simplicity, create a tenant per organization
    // Use organizationId as subdomain (sanitized)
    const subdomain = organizationId.replace(/[^a-z0-9-]/gi, '-').toLowerCase().substring(0, 50)
    
    // Check if tenant with this subdomain exists
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1)
    
    if (existingTenant) {
      return existingTenant.id
    }
    
    // Create new tenant for this organization
    // Handle potential race condition where tenant might be created between check and insert
    try {
      const tenantId = crypto.randomUUID()
      await db.insert(tenants).values({
        id: tenantId,
        name: `Organization ${organizationId.substring(0, 8)}`,
        subdomain: subdomain,
        tier: 'free',
        active: true,
      })
      
      console.log(`✅ Created tenant ${tenantId} for organization ${organizationId}`)
      return tenantId
    } catch (insertError: any) {
      // If insert fails due to unique constraint, try to fetch again
      if (insertError?.code === '23505' || insertError?.message?.includes('unique')) {
        const [retryTenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.subdomain, subdomain))
          .limit(1)
        
        if (retryTenant) {
          return retryTenant.id
        }
      }
      throw insertError
    }
  } catch (error) {
    console.error('❌ Error getting/creating tenant:', error)
    throw new Error(`Failed to get/create tenant: ${error}`)
  }
}

// Validation schemas - transform empty strings to undefined for optional URL fields
const createCourseSchema = z.object({
  title: z.string().min(1).max(200).describe('Course title'),
  description: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()).describe('Course description'),
  thumbnail: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()).describe('Course thumbnail URL'),
  categories: z.array(z.string()).default([]).describe('Course categories'),
  instructorId: z.preprocess((val) => (val === '' ? undefined : val), z.string().uuid().optional()),
  instructor: z.string().min(1).max(100).describe('Instructor name'),
  instructorBio: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()).describe('Instructor bio'),
  instructorAvatar: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()).describe('Instructor avatar URL'),
  tier: z.enum(['free', 'pro']).default('free').describe('Course tier'),
  published: z.boolean().default(false).describe('Whether course is published'),
  order: z.number().int().default(0).describe('Display order'),
})

const updateCourseSchema = createCourseSchema.partial().extend({
  instructorId: z.preprocess((val) => (val === '' ? undefined : val), z.string().uuid().nullable().optional()),
})

const createModuleSchema = z.object({
  courseId: z.string().uuid().describe('Course ID'),
  title: z.string().min(1).max(200).describe('Module title'),
  description: z.string().optional().describe('Module description'),
  order: z.number().int().default(0).describe('Display order'),
  published: z.boolean().default(false).describe('Whether module is published'),
})

const updateModuleSchema = createModuleSchema.partial().omit({ courseId: true })

const createLessonSchema = z.object({
  moduleId: z.string().uuid().describe('Module ID'),
  title: z.string().min(1).max(200).describe('Lesson title'),
  description: z.string().optional().describe('Lesson description'),
  content: z.string().optional().describe('Lesson content text (appears below video)'),
  videoUrl: z.string().url().optional().describe('Video URL'),
  videoProvider: z.enum(['youtube', 'vimeo', 'cloudflare', 'custom']).optional().describe('Video provider'),
  duration: z.number().int().positive().optional().describe('Duration in seconds'),
  thumbnail: z.string().url().optional().describe('Lesson thumbnail URL'),
  transcript: z.string().optional().describe('Transcript text'),
  transcriptUrl: z.string().url().optional().describe('Transcript URL'),
  resources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    type: z.enum(['pdf', 'document', 'link', 'file']),
  })).optional().describe('Lesson resources'),
  published: z.boolean().default(false).describe('Whether lesson is published'),
  order: z.number().int().default(0).describe('Display order'),
})

const updateLessonSchema = createLessonSchema.partial().omit({ moduleId: true })

const courseIdSchema = z.object({
  id: z.string().uuid().describe('Course ID'),
})

const moduleIdSchema = z.object({
  id: z.string().uuid().describe('Module ID'),
})

const lessonIdSchema = z.object({
  id: z.string().uuid().describe('Lesson ID'),
})

/**
 * GET /api/v1/courses - List all courses
 *
 * Returns all published courses with enrollment status and progress for current user
 */
coursesApp.get('/', async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { courses, modules, lessons, courseEnrollments, instructors } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Get all published courses for this tenant with instructor data
    const allCourses = await db
      .select({
        course: courses,
        instructor: instructors,
      })
      .from(courses)
      .leftJoin(instructors, eq(courses.instructorId, instructors.id))
      .where(and(
        eq(courses.tenantId, tenantId),
        eq(courses.published, true)
      ))
      .orderBy(desc(courses.order), desc(courses.createdAt))

    // Get enrollment data for current user
    const userEnrollments = await db
      .select()
      .from(courseEnrollments)
      .where(and(
        eq(courseEnrollments.tenantId, tenantId),
        eq(courseEnrollments.userId, user.id)
      ))

    // Get module and lesson counts for each course
    const coursesWithStats = await Promise.all(
      allCourses.map(async (item) => {
        const courseModules = await db
          .select()
          .from(modules)
          .where(and(
            eq(modules.courseId, item.course.id),
            eq(modules.published, true)
          ))

        const moduleIds = courseModules.map(m => m.id)
        const courseLessons = moduleIds.length > 0 ? await db
          .select()
          .from(lessons)
          .where(and(
            inArray(lessons.moduleId, moduleIds),
            eq(lessons.published, true)
          )) : []

        const enrollment = userEnrollments.find(e => e.courseId === item.course.id)

        // Calculate total duration
        const totalDuration = courseLessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0)

        // Merge instructor avatar into course if instructor exists
        const courseWithInstructor = {
          ...item.course,
          instructorAvatar: item.instructor?.avatarUrl || item.course.instructorAvatar,
        }

        return {
          course: courseWithInstructor,
          moduleCount: courseModules.length,
          lessonCount: courseLessons.length,
          totalDuration,
          isEnrolled: !!enrollment,
          progress: enrollment?.progressPercentage || 0,
          completedLessons: enrollment?.completedLessons || [],
          lastAccessedAt: enrollment?.lastAccessedAt || null,
        }
      })
    )

    return c.json({ courses: coursesWithStats })
  } catch (error) {
    console.error('❌ List courses error:', error)
    return c.json({ error: 'Failed to fetch courses' }, 500)
  }
})

/**
 * GET /api/v1/courses/:id - Get course detail with modules and lessons
 */
coursesApp.get('/:id', zValidator('param', courseIdSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const { id } = c.req.valid('param')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { courses, modules, lessons } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Get course
    const [course] = await db
      .select()
      .from(courses)
      .where(and(
        eq(courses.id, id),
        eq(courses.tenantId, tenantId)
      ))
      .limit(1)

    if (!course) {
      return c.json({ error: 'Course not found' }, 404)
    }

    // Check if user has access (published or user is owner/admin)
    const organizationRole = c.get('organizationRole')
    const isOwner = organizationRole === 'owner' || user.isGod
    if (!course.published && !isOwner) {
      return c.json({ error: 'Course not found' }, 404)
    }

    // Get modules with lessons
    const courseModules = await db
      .select()
      .from(modules)
      .where(and(
        eq(modules.courseId, id),
        eq(modules.tenantId, tenantId)
      ))
      .orderBy(asc(modules.order), asc(modules.createdAt))

    const modulesWithLessons = await Promise.all(
      courseModules.map(async (module) => {
        const moduleLessons = await db
          .select()
          .from(lessons)
          .where(and(
            eq(lessons.moduleId, module.id),
            eq(lessons.tenantId, tenantId)
          ))
          .orderBy(asc(lessons.order), asc(lessons.createdAt))

        return {
          ...module,
          lessons: moduleLessons,
        }
      })
    )

    return c.json({
      ...course,
      modules: modulesWithLessons,
    })
  } catch (error) {
    console.error('❌ Get course error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error details:', errorMessage)
    return c.json({ error: `Failed to fetch course: ${errorMessage}` }, 500)
  }
})

/**
 * POST /api/v1/courses - Create new course (Owner/Admin only)
 */
coursesApp.post('/', zValidator('json', createCourseSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const data = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner/admin
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can create courses' }, 403)
    }

    if (!data.instructorId && !data.instructor) {
      return c.json({ error: 'Instructor information is required' }, 400)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { courses, instructors } })

    const tenantId = await getTenantId(c.env, organizationId)

    let instructorRecord: typeof instructors.$inferSelect | null = null

    if (data.instructorId) {
      const [record] = await db
        .select()
        .from(instructors)
        .where(and(eq(instructors.id, data.instructorId), eq(instructors.tenantId, tenantId)))
        .limit(1)

      if (!record) {
        return c.json({ error: 'Instructor not found' }, 404)
      }

      instructorRecord = record
    }

    const instructorName = instructorRecord?.name || data.instructor
    if (!instructorName) {
      return c.json({ error: 'Instructor name is required' }, 400)
    }

    const instructorBio = instructorRecord?.bio ?? data.instructorBio ?? null
    const instructorAvatar = instructorRecord?.avatarUrl ?? data.instructorAvatar ?? null

    console.log('➕ Create course:', { userId: user.id, organizationId, title: data.title })

    const [newCourse] = await db.insert(courses).values({
      tenantId,
      instructorId: instructorRecord?.id ?? null,
      title: data.title,
      description: data.description || null,
      thumbnail: data.thumbnail || null,
      category: data.category || null,
      instructor: instructorName,
      instructorBio,
      instructorAvatar,
      tier: data.tier || 'free',
      published: data.published || false,
      order: data.order || 0,
      enrollmentCount: 0,
    }).returning()

    console.log('✅ Course created:', newCourse.id)

    return c.json({ course: newCourse, success: true })
  } catch (error) {
    console.error('❌ Create course error:', error)
    return c.json({ error: 'Failed to create course' }, 500)
  }
})

/**
 * PATCH /api/v1/courses/:id - Update course (Owner/Admin only)
 */
coursesApp.patch('/:id', zValidator('param', courseIdSchema), zValidator('json', updateCourseSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner/admin
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can update courses' }, 403)
    }

    if (updates.instructorId === undefined && !updates.instructor && !updates.instructorBio && !updates.instructorAvatar) {
      // no instructor update requested, proceed
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { courses, instructors } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Verify course exists and belongs to tenant
    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(and(
        eq(courses.id, id),
        eq(courses.tenantId, tenantId)
      ))
      .limit(1)

    if (!existingCourse) {
      return c.json({ error: 'Course not found' }, 404)
    }

    let instructorRecord: typeof instructors.$inferSelect | null = null
    let instructorName = updates.instructor ?? existingCourse.instructor
    let instructorBio = updates.instructorBio ?? existingCourse.instructorBio
    let instructorAvatar = updates.instructorAvatar ?? existingCourse.instructorAvatar
    let instructorIdValue = existingCourse.instructorId

    if (updates.instructorId !== undefined) {
      if (updates.instructorId === null) {
        instructorRecord = null
        instructorIdValue = null
      } else {
        const [record] = await db
          .select()
          .from(instructors)
          .where(and(eq(instructors.id, updates.instructorId), eq(instructors.tenantId, tenantId)))
          .limit(1)

        if (!record) {
          return c.json({ error: 'Instructor not found' }, 404)
        }

        instructorRecord = record
        instructorIdValue = record.id
        instructorName = record.name
        instructorBio = record.bio ?? null
        instructorAvatar = record.avatarUrl ?? null
      }
    }

    if (!instructorName) {
      return c.json({ error: 'Instructor name is required' }, 400)
    }

    console.log('✏️ Update course:', { id, userId: user.id, organizationId })

    const [updatedCourse] = await db
      .update(courses)
      .set({
        ...updates,
        instructorId: instructorIdValue,
        instructor: instructorName,
        instructorBio,
        instructorAvatar,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning()

    return c.json({ course: updatedCourse, success: true })
  } catch (error) {
    console.error('❌ Update course error:', error)
    return c.json({ error: 'Failed to update course' }, 500)
    }
})

/**
 * DELETE /api/v1/courses/:id - Delete course (Owner/Admin only)
 */
coursesApp.delete('/:id', zValidator('param', courseIdSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner/admin
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can delete courses' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { courses } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Verify course exists and belongs to tenant
    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(and(
        eq(courses.id, id),
        eq(courses.tenantId, tenantId)
      ))
      .limit(1)

    if (!existingCourse) {
      return c.json({ error: 'Course not found' }, 404)
    }

    console.log('🗑️ Delete course:', { id, userId: user.id, organizationId })

    // Cascade delete will handle modules and lessons
    await db.delete(courses).where(eq(courses.id, id))

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete course error:', error)
    return c.json({ error: 'Failed to delete course' }, 500)
  }
})

/**
 * GET /api/v1/courses/lessons/:id - Get lesson detail
 */
coursesApp.get('/lessons/:id', zValidator('param', lessonIdSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const { id } = c.req.valid('param')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { lessons, modules, courses, lessonProgress } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Get lesson with module and course info
    const [lesson] = await db
      .select({
        lesson: lessons,
        module: modules,
        course: courses,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .where(and(
        eq(lessons.id, id),
        eq(lessons.tenantId, tenantId)
      ))
      .limit(1)

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404)
    }

    // Get user's progress for this lesson
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(and(
        eq(lessonProgress.lessonId, id),
        eq(lessonProgress.userId, user.id),
        eq(lessonProgress.tenantId, tenantId)
      ))
      .limit(1)

    return c.json({
      ...lesson.lesson,
      module: lesson.module,
      course: lesson.course,
      progress: progress || null,
    })
  } catch (error) {
    console.error('❌ Get lesson error:', error)
    return c.json({ error: 'Failed to fetch lesson' }, 500)
  }
})

/**
 * POST /api/v1/courses/modules - Create module (Owner/Admin only)
 */
coursesApp.post('/modules', zValidator('json', createModuleSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const data = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can create modules' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { modules, courses } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Verify course exists and belongs to tenant
    const [course] = await db
      .select()
      .from(courses)
      .where(and(
        eq(courses.id, data.courseId),
        eq(courses.tenantId, tenantId)
      ))
      .limit(1)

    if (!course) {
      return c.json({ error: 'Course not found' }, 404)
    }

    const [newModule] = await db.insert(modules).values({
      courseId: data.courseId,
      tenantId,
      title: data.title,
      description: data.description || null,
      order: data.order || 0,
      published: data.published || false,
    }).returning()

    return c.json({ module: newModule, success: true })
  } catch (error) {
    console.error('❌ Create module error:', error)
    return c.json({ error: 'Failed to create module' }, 500)
  }
})

/**
 * PATCH /api/v1/courses/modules/:id - Update module (Owner/Admin only)
 */
coursesApp.patch('/modules/:id', zValidator('param', moduleIdSchema), zValidator('json', updateModuleSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can update modules' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { modules } })

    const tenantId = await getTenantId(c.env, organizationId)

    const [updatedModule] = await db
      .update(modules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(modules.id, id),
        eq(modules.tenantId, tenantId)
      ))
      .returning()

    if (!updatedModule) {
      return c.json({ error: 'Module not found' }, 404)
    }

    return c.json({ module: updatedModule, success: true })
  } catch (error) {
    console.error('❌ Update module error:', error)
    return c.json({ error: 'Failed to update module' }, 500)
  }
})

/**
 * DELETE /api/v1/courses/modules/:id - Delete module (Owner/Admin only)
 */
coursesApp.delete('/modules/:id', zValidator('param', moduleIdSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can delete modules' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { modules } })

    const tenantId = await getTenantId(c.env, organizationId)

    await db.delete(modules).where(and(
      eq(modules.id, id),
      eq(modules.tenantId, tenantId)
    ))

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete module error:', error)
    return c.json({ error: 'Failed to delete module' }, 500)
  }
})

/**
 * POST /api/v1/courses/lessons - Create lesson (Owner/Admin only)
 */
coursesApp.post('/lessons', zValidator('json', createLessonSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const data = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can create lessons' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { lessons, modules } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Verify module exists and belongs to tenant
    const [module] = await db
      .select()
      .from(modules)
      .where(and(
        eq(modules.id, data.moduleId),
        eq(modules.tenantId, tenantId)
      ))
      .limit(1)

    if (!module) {
      return c.json({ error: 'Module not found' }, 404)
    }

    const [newLesson] = await db.insert(lessons).values({
      moduleId: data.moduleId,
      tenantId,
      title: data.title,
      description: data.description || null,
      videoUrl: data.videoUrl || null,
      videoProvider: data.videoProvider || null,
      duration: data.duration || null,
      thumbnail: data.thumbnail || null,
      transcript: data.transcript || null,
      transcriptUrl: data.transcriptUrl || null,
      resources: data.resources || [],
      published: data.published || false,
      order: data.order || 0,
    }).returning()

    return c.json({ lesson: newLesson, success: true })
  } catch (error) {
    console.error('❌ Create lesson error:', error)
    return c.json({ error: 'Failed to create lesson' }, 500)
  }
})

/**
 * PATCH /api/v1/courses/lessons/:id - Update lesson (Owner/Admin only)
 */
coursesApp.patch('/lessons/:id', zValidator('param', lessonIdSchema), zValidator('json', updateLessonSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can update lessons' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { lessons } })

    const tenantId = await getTenantId(c.env, organizationId)

    const [updatedLesson] = await db
      .update(lessons)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(lessons.id, id),
        eq(lessons.tenantId, tenantId)
      ))
      .returning()

    if (!updatedLesson) {
      return c.json({ error: 'Lesson not found' }, 404)
    }

    return c.json({ lesson: updatedLesson, success: true })
  } catch (error) {
    console.error('❌ Update lesson error:', error)
    return c.json({ error: 'Failed to update lesson' }, 500)
  }
})

/**
 * DELETE /api/v1/courses/lessons/:id - Delete lesson (Owner/Admin only)
 */
coursesApp.delete('/lessons/:id', zValidator('param', lessonIdSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { id } = c.req.valid('param')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can delete lessons' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { lessons } })

    const tenantId = await getTenantId(c.env, organizationId)

    await db.delete(lessons).where(and(
      eq(lessons.id, id),
      eq(lessons.tenantId, tenantId)
    ))

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Delete lesson error:', error)
    return c.json({ error: 'Failed to delete lesson' }, 500)
  }
})

/**
 * PATCH /api/v1/courses/:courseId/reorder - Bulk reorder modules and lessons
 */
const reorderSchema = z.object({
  modules: z.array(z.object({
    id: z.string().uuid(),
    order: z.number().int(),
  })).optional(),
  lessons: z.array(z.object({
    id: z.string().uuid(),
    moduleId: z.string().uuid(),
    order: z.number().int(),
  })).optional(),
})

coursesApp.patch('/:courseId/reorder', zValidator('param', z.object({ courseId: z.string().uuid() })), zValidator('json', reorderSchema), async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')
    const { courseId } = c.req.valid('param')
    const { modules: moduleOrders, lessons: lessonOrders } = c.req.valid('json')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can reorder content' }, 403)
    }

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema: { modules, lessons, courses } })

    const tenantId = await getTenantId(c.env, organizationId)

    // Verify course exists and belongs to tenant
    const [course] = await db
      .select()
      .from(courses)
      .where(and(
        eq(courses.id, courseId),
        eq(courses.tenantId, tenantId)
      ))
      .limit(1)

    if (!course) {
      return c.json({ error: 'Course not found' }, 404)
    }

    // Update module orders
    if (moduleOrders && moduleOrders.length > 0) {
      await Promise.all(
        moduleOrders.map(({ id, order }) =>
          db
            .update(modules)
            .set({ order, updatedAt: new Date() })
            .where(and(
              eq(modules.id, id),
              eq(modules.courseId, courseId),
              eq(modules.tenantId, tenantId)
            ))
        )
      )
    }

    // Update lesson orders and module assignments
    if (lessonOrders && lessonOrders.length > 0) {
      // Verify all target modules belong to this course
      const moduleIds = await db
        .select({ id: modules.id })
        .from(modules)
        .where(and(
          eq(modules.courseId, courseId),
          eq(modules.tenantId, tenantId)
        ))

      const validModuleIds = new Set(moduleIds.map(m => m.id))

      for (const { id, moduleId, order } of lessonOrders) {
        if (!validModuleIds.has(moduleId)) {
          return c.json({ error: `Invalid target module ${moduleId}` }, 400)
        }

        // Update lesson: set new module, order, and updatedAt
        // This allows moving lessons between modules
        await db
          .update(lessons)
          .set({ 
            moduleId: moduleId,  // Update module assignment
            order: order,         // Update order
            updatedAt: new Date() 
          })
          .where(and(
            eq(lessons.id, id),
            eq(lessons.tenantId, tenantId)
          ))
      }
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('❌ Reorder error:', error)
    return c.json({ error: 'Failed to reorder content' }, 500)
  }
})

export default coursesApp

