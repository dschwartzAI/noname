# Syndicate LMS Implementation Guide

## Overview

A minimal, mobile-first LMS (Learning Management System) built for SoloOS with three main features:
- **Classroom**: Courses → Modules → Lessons with video player
- **Calendar**: Event management and scheduling  
- **Message Board**: Community discussions and Q&A

## Architecture

### Database Schema (Neon Postgres)

**Courses System:**
- `courses` - Course catalog
- `modules` - Course sections
- `lessons` - Individual lessons with video/transcript
- `course_enrollments` - User enrollment tracking
- `lesson_progress` - Per-lesson completion tracking

**Calendar System:**
- `calendar_events` - Events with meetings/classes/deadlines
- `event_rsvps` - User RSVP tracking

**Message Board:**
- `board_categories` - Discussion categories
- `board_threads` - Discussion threads
- `board_replies` - Thread replies (nested support)
- `board_likes` - Like tracking
- `board_subscriptions` - Notification subscriptions

All tables include `tenantId` for multi-tenancy support.

### API Routes (Hono)

**Courses API (`/api/v1/courses`):**
```
GET    /                           # List all courses
GET    /:courseId                  # Get course with modules/lessons
POST   /:courseId/enroll           # Enroll user
POST   /:courseId/progress         # Update progress
GET    /lessons/:lessonId          # Get lesson details
POST   /lessons/:lessonId/progress # Update lesson progress
POST   /lessons/:lessonId/complete # Mark complete
```

**Calendar API (`/api/v1/calendar`):**
```
GET    /                    # Get events (query: startDate, endDate, type, category)
GET    /:eventId            # Get event details
POST   /                    # Create event
PATCH  /:eventId            # Update event
DELETE /:eventId            # Delete event
POST   /:eventId/cancel     # Cancel event (soft delete)
POST   /:eventId/rsvp       # RSVP to event
GET    /:eventId/rsvps      # Get event RSVPs
```

**Message Board API (`/api/v1/board`):**
```
GET    /categories              # Get categories
GET    /threads                 # List threads (query: categoryId, sort)
GET    /threads/:threadId       # Get thread with replies
POST   /threads                 # Create thread
POST   /threads/:threadId/replies   # Reply to thread
POST   /threads/:threadId/like      # Like thread
DELETE /threads/:threadId/like      # Unlike thread
```

### Frontend Routes (TanStack Router)

```
/syndicate                                    # Hub page
/syndicate/classroom                          # Course catalog
/syndicate/classroom/:courseId                # Course detail
/syndicate/classroom/:courseId/:lessonId      # Lesson player
/syndicate/calendar                           # Calendar view
/syndicate/board                              # Message board
/syndicate/board/:threadId                    # Thread detail
```

## Key Features

### Mobile-First Design
- Responsive grid layouts (1 col mobile → 2-3 cols desktop)
- Touch-friendly card components
- Mobile-optimized video player
- Collapsible accordion for modules
- Bottom-aligned action buttons

### Component Reuse
Uses existing shadcn components:
- `Card` - All content containers
- `Badge` - Status indicators
- `Progress` - Course completion
- `Accordion` - Module lists
- `Skeleton` - Loading states
- `Tabs` - Board categories
- `Textarea` - Reply forms
- `Button` - All actions

### Minimal Code
- **Backend**: ~500 lines total (3 files)
- **Frontend**: ~700 lines total (8 files)
- **Database**: ~450 lines total (3 schemas)

## Usage Examples

### Creating a Course (Backend needed)
```typescript
// Insert course
await db.insert(courses).values({
  tenantId: 'tenant-uuid',
  title: 'Getting Started with AI',
  description: 'Learn the basics...',
  instructor: 'Jane Doe',
  published: true
})

// Add module
await db.insert(modules).values({
  courseId: 'course-uuid',
  tenantId: 'tenant-uuid',
  title: 'Introduction',
  order: 0
})

// Add lesson
await db.insert(lessons).values({
  moduleId: 'module-uuid',
  tenantId: 'tenant-uuid',
  title: 'Welcome Video',
  videoUrl: 'https://...',
  duration: 300
})
```

### Creating a Calendar Event (API)
```typescript
POST /api/v1/calendar
{
  "title": "Office Hours",
  "type": "office_hours",
  "startTime": "2025-01-15T14:00:00Z",
  "endTime": "2025-01-15T15:00:00Z",
  "meetingUrl": "https://meet.google.com/..."
}
```

### Creating a Discussion Thread (API)
```typescript
POST /api/v1/board/threads
{
  "categoryId": "category-uuid",
  "title": "How to use AI tools?",
  "content": "I'm new to AI and wondering...",
  "tags": ["beginner", "tools"]
}
```

## Next Steps

### Phase 1: Data Seeding
1. Create default board categories
2. Seed sample courses
3. Add demo calendar events

### Phase 2: Admin Interface
1. Course builder UI
2. Event creator form
3. Category management

### Phase 3: Enhanced Features
1. Video upload to Cloudflare Stream
2. Email notifications for calendar
3. Rich text editor for discussions
4. Search functionality
5. User achievements/certificates

## Mobile Optimization Notes

All pages use:
- `container max-w-{size}` for content width
- `grid gap-4 md:grid-cols-2 lg:grid-cols-3` for responsive grids
- `flex-col md:flex-row` for layout switching
- `text-sm md:text-base` for font scaling
- Touch-friendly 44px minimum tap targets
- No fixed positioning (except sidebar)

## Dependencies Added

None! Uses existing stack:
- Hono (API routes)
- Drizzle (ORM)
- TanStack Query (data fetching)
- shadcn/ui (components)
- TanStack Router (routing)

## Deployment

1. **Run migrations:**
   ```bash
   npm run db:push
   ```

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

3. **Access Syndicate:**
   Navigate to `/syndicate` in the app

## File Structure

```
src/
├── server/routes/
│   ├── courses.ts          # Course API
│   ├── calendar.ts         # Calendar API
│   └── message-board.ts    # Board API
├── routes/_authenticated/syndicate/
│   ├── route.tsx                          # Layout
│   ├── index.tsx                          # Hub
│   ├── classroom.tsx                      # Catalog
│   ├── classroom.$courseId.tsx            # Course
│   ├── classroom.$courseId.$lessonId.tsx  # Lesson
│   ├── calendar.tsx                       # Calendar
│   ├── board.tsx                          # Board
│   └── board.$threadId.tsx                # Thread
database/schema/
├── courses.ts              # Course schemas
├── calendar.ts             # Calendar schemas
└── message-board.ts        # Board schemas
```

---

**Total Implementation Time:** ~2 hours  
**Lines of Code:** ~1,650  
**Components Created:** 0 (reused existing)  
**Mobile-Ready:** ✅  
**Production-Ready:** ⚠️  (needs data seeding)




