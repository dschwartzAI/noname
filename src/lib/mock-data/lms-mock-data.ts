/**
 * Mock data for LMS features (Calendar, Courses, Message Board)
 * Used for development/testing until backend APIs are implemented
 */

import { SelectCourse, SelectModule, SelectLesson } from '@/database/schema/courses'
import { SelectCalendarEvent } from '@/database/schema/calendar'
import { SelectBoardThread, SelectBoardCategory } from '@/database/schema/message-board'

// Mock Courses Data
export const mockCourses = [
  {
    course: {
      id: 'course-1',
      tenantId: 'tenant-1',
      title: 'Complete Marketing Mastery',
      description: 'Learn the fundamentals of digital marketing, SEO, content strategy, and social media marketing to grow your business.',
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
      instructor: 'James Kemp',
      instructorBio: 'Marketing expert with 15+ years experience',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
      tier: 'pro',
      published: true,
      enrollmentCount: 124,
      order: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    } as SelectCourse,
    moduleCount: 8,
    lessonCount: 42,
    totalDuration: 43200, // 12 hours in seconds
    isEnrolled: true,
    progress: 40,
    completedLessons: ['lesson-1', 'lesson-2', 'lesson-3'],
    lastAccessedAt: new Date(),
  },
  {
    course: {
      id: 'course-2',
      tenantId: 'tenant-1',
      title: 'Sales Funnel Optimization',
      description: 'Build high-converting sales funnels that turn prospects into customers. Learn funnel psychology, copywriting, and conversion optimization.',
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
      instructor: 'Sarah Lee',
      instructorBio: 'Conversion rate optimization specialist',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      tier: 'pro',
      published: true,
      enrollmentCount: 89,
      order: 2,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    } as SelectCourse,
    moduleCount: 12,
    lessonCount: 56,
    totalDuration: 57600, // 16 hours
    isEnrolled: true,
    progress: 20,
    completedLessons: ['lesson-10', 'lesson-11'],
    lastAccessedAt: new Date('2024-11-10'),
  },
  {
    course: {
      id: 'course-3',
      tenantId: 'tenant-1',
      title: 'Product Launch Masterclass',
      description: 'Successfully launch your product with proven strategies. From pre-launch to post-launch marketing.',
      thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
      instructor: 'Mike Chen',
      instructorBio: 'Product launch expert',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
      tier: 'free',
      published: true,
      enrollmentCount: 203,
      order: 3,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    } as SelectCourse,
    moduleCount: 6,
    lessonCount: 28,
    totalDuration: 21600, // 6 hours
    isEnrolled: true,
    progress: 100,
    completedLessons: ['lesson-20', 'lesson-21', 'lesson-22', 'lesson-23'],
    lastAccessedAt: new Date('2024-11-05'),
  },
  {
    course: {
      id: 'course-4',
      tenantId: 'tenant-1',
      title: 'Social Media Strategy 2024',
      description: 'Master Instagram, TikTok, LinkedIn, and Twitter. Learn content creation, engagement tactics, and platform-specific strategies.',
      thumbnail: 'https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=800&q=80',
      instructor: 'Emma Davis',
      instructorBio: 'Social media consultant',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
      tier: 'pro',
      published: true,
      enrollmentCount: 156,
      order: 4,
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    } as SelectCourse,
    moduleCount: 10,
    lessonCount: 48,
    totalDuration: 36000, // 10 hours
    isEnrolled: false,
    progress: 0,
    completedLessons: [],
    lastAccessedAt: null,
  },
  {
    course: {
      id: 'course-5',
      tenantId: 'tenant-1',
      title: 'Email Marketing Fundamentals',
      description: 'Build and grow your email list. Write compelling copy, design beautiful emails, and automate your campaigns.',
      thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80',
      instructor: 'James Kemp',
      instructorBio: 'Marketing expert with 15+ years experience',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
      tier: 'free',
      published: true,
      enrollmentCount: 312,
      order: 5,
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
    } as SelectCourse,
    moduleCount: 5,
    lessonCount: 22,
    totalDuration: 14400, // 4 hours
    isEnrolled: false,
    progress: 0,
    completedLessons: [],
    lastAccessedAt: null,
  },
  {
    course: {
      id: 'course-6',
      tenantId: 'tenant-1',
      title: 'SEO & Content Strategy',
      description: 'Rank higher on Google. Learn keyword research, on-page SEO, link building, and content optimization.',
      thumbnail: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80',
      instructor: 'David Park',
      instructorBio: 'SEO consultant and content strategist',
      instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
      tier: 'pro',
      published: true,
      enrollmentCount: 98,
      order: 6,
      createdAt: new Date('2024-03-15'),
      updatedAt: new Date('2024-03-15'),
    } as SelectCourse,
    moduleCount: 9,
    lessonCount: 38,
    totalDuration: 32400, // 9 hours
    isEnrolled: true,
    progress: 65,
    completedLessons: ['lesson-30', 'lesson-31', 'lesson-32'],
    lastAccessedAt: new Date('2024-11-11'),
  },
]

// Mock Course Detail (with modules and lessons)
export const mockCourseDetail = {
  course: mockCourses[0].course,
  modules: [
    {
      id: 'module-1',
      courseId: 'course-1',
      tenantId: 'tenant-1',
      title: 'Marketing Fundamentals',
      description: 'Learn the core principles of marketing',
      order: 1,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lessons: [
        {
          id: 'lesson-1',
          moduleId: 'module-1',
          tenantId: 'tenant-1',
          title: 'Welcome to Marketing Mastery',
          description: 'An introduction to the course and what you will learn',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          duration: 332,
          published: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectLesson,
        {
          id: 'lesson-2',
          moduleId: 'module-1',
          tenantId: 'tenant-1',
          title: 'Understanding Your Target Audience',
          description: 'Learn how to identify and understand your ideal customer',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          duration: 890,
          published: true,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectLesson,
        {
          id: 'lesson-3',
          moduleId: 'module-1',
          tenantId: 'tenant-1',
          title: 'The Marketing Mix: 4Ps Framework',
          description: 'Product, Price, Place, and Promotion explained',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          duration: 1205,
          published: true,
          order: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectLesson,
      ],
    } as SelectModule & { lessons: SelectLesson[] },
    {
      id: 'module-2',
      courseId: 'course-1',
      tenantId: 'tenant-1',
      title: 'Digital Marketing Channels',
      description: 'Explore different digital marketing platforms',
      order: 2,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lessons: [
        {
          id: 'lesson-4',
          moduleId: 'module-2',
          tenantId: 'tenant-1',
          title: 'Social Media Marketing Overview',
          description: 'Introduction to marketing on social platforms',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          duration: 756,
          published: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectLesson,
        {
          id: 'lesson-5',
          moduleId: 'module-2',
          tenantId: 'tenant-1',
          title: 'Email Marketing Basics',
          description: 'How to build and nurture an email list',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          duration: 1089,
          published: true,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectLesson,
      ],
    } as SelectModule & { lessons: SelectLesson[] },
  ],
  enrollment: {
    progressPercentage: 40,
    completedLessons: ['lesson-1', 'lesson-2'],
    lastAccessedLessonId: 'lesson-3',
  },
  stats: {
    moduleCount: 2,
    lessonCount: 5,
    totalDuration: 4272,
  },
}

// Mock Lesson Detail
export const mockLessonDetail = {
  lesson: {
    id: 'lesson-1',
    moduleId: 'module-1',
    tenantId: 'tenant-1',
    title: 'Welcome to Marketing Mastery',
    description: 'In this introductory lesson, we will cover the scope of the course, what you will learn, and how to get the most out of this material.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoProvider: 'youtube',
    duration: 332,
    transcript: `[00:00] Welcome to Marketing Mastery! I'm thrilled to have you here.

[00:15] In this course, we're going to dive deep into the world of digital marketing.

[00:32] We'll cover everything from social media to email marketing, SEO, and more.

[01:00] By the end of this course, you'll have a comprehensive understanding of how to grow your business online.`,
    resources: [
      {
        id: 'resource-1',
        name: 'Course Workbook.pdf',
        url: 'https://example.com/workbook.pdf',
        type: 'pdf' as const,
      },
      {
        id: 'resource-2',
        name: 'Marketing Templates',
        url: 'https://example.com/templates.zip',
        type: 'file' as const,
      },
    ],
    published: true,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SelectLesson,
  progress: {
    completed: false,
    lastWatchPosition: 0,
  },
  navigation: {
    previousLessonId: null,
    nextLessonId: 'lesson-2',
  },
  course: {
    title: 'Complete Marketing Mastery',
  },
}

// Mock Calendar Events
export const mockCalendarEvents = [
  {
    event: {
      id: 'event-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      title: 'Office Hours with James',
      description: 'Weekly Q&A session - bring your marketing questions!',
      type: 'office_hours' as const,
      startTime: new Date('2024-11-14T18:00:00'),
      endTime: new Date('2024-11-14T19:00:00'),
      allDay: false,
      meetingUrl: 'https://zoom.us/j/123456789',
      recurring: true,
      recurrenceRule: {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [4], // Thursday
      },
      color: '#3b82f6',
      visibility: 'organization' as const,
      cancelled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SelectCalendarEvent,
  },
  {
    event: {
      id: 'event-2',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      title: 'Community Call - November',
      description: 'Monthly community networking and discussion',
      type: 'meeting' as const,
      startTime: new Date('2024-11-15T14:00:00'),
      endTime: new Date('2024-11-15T15:30:00'),
      allDay: false,
      meetingUrl: 'https://zoom.us/j/987654321',
      recurring: false,
      color: '#10b981',
      visibility: 'organization' as const,
      cancelled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SelectCalendarEvent,
  },
  {
    event: {
      id: 'event-3',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      title: 'SEO Workshop',
      description: 'Hands-on workshop for improving your website SEO',
      type: 'class' as const,
      startTime: new Date('2024-11-20T18:00:00'),
      endTime: new Date('2024-11-20T20:00:00'),
      allDay: false,
      location: 'Online',
      meetingUrl: 'https://zoom.us/j/456789123',
      recurring: false,
      color: '#8b5cf6',
      visibility: 'organization' as const,
      cancelled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SelectCalendarEvent,
  },
]

// Mock Board Categories
export const mockBoardCategories = [
  {
    id: 'cat-1',
    tenantId: 'tenant-1',
    name: 'General',
    description: 'General discussions and announcements',
    icon: '💬',
    color: '#6b7280',
    order: 1,
    createdAt: new Date(),
  } as SelectBoardCategory,
  {
    id: 'cat-2',
    tenantId: 'tenant-1',
    name: 'Development',
    description: 'Technical discussions and coding help',
    icon: '💻',
    color: '#3b82f6',
    order: 2,
    createdAt: new Date(),
  } as SelectBoardCategory,
  {
    id: 'cat-3',
    tenantId: 'tenant-1',
    name: 'Marketing',
    description: 'Marketing strategies and tips',
    icon: '📈',
    color: '#10b981',
    order: 3,
    createdAt: new Date(),
  } as SelectBoardCategory,
  {
    id: 'cat-4',
    tenantId: 'tenant-1',
    name: 'Wins',
    description: 'Share your victories and successes',
    icon: '🎉',
    color: '#f59e0b',
    order: 4,
    createdAt: new Date(),
  } as SelectBoardCategory,
]

// Mock Board Threads
export const mockBoardThreads = [
  {
    id: 'thread-1',
    tenantId: 'tenant-1',
    categoryId: 'cat-1',
    authorId: 'user-1',
    title: 'Welcome to the Community! 👋',
    content: `Hey everyone! Welcome to our community forum.

This is a place to ask questions, share wins, and connect with fellow members. Feel free to introduce yourself and let us know what you're working on!`,
    pinned: true,
    locked: false,
    solved: false,
    viewCount: 342,
    replyCount: 18,
    likeCount: 45,
    tags: ['welcome', 'introduction'],
    createdAt: new Date('2024-11-01'),
    updatedAt: new Date('2024-11-01'),
    author: {
      name: 'James Kemp',
      email: 'james@example.com',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    },
    category: mockBoardCategories[0],
    isLiked: false,
  },
  {
    id: 'thread-2',
    tenantId: 'tenant-1',
    categoryId: 'cat-2',
    authorId: 'user-2',
    title: 'How do I implement rate limiting?',
    content: `I'm trying to add rate limiting to my Express API but I'm not sure which library to use. Has anyone tried express-rate-limit? What are your recommendations?

I need something that can:
- Limit requests per IP
- Have different limits for different endpoints
- Work with Redis for distributed systems`,
    pinned: false,
    locked: false,
    solved: true,
    viewCount: 89,
    replyCount: 8,
    likeCount: 12,
    tags: ['expressjs', 'nodejs', 'api'],
    createdAt: new Date('2024-11-12'),
    updatedAt: new Date('2024-11-12'),
    author: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
    category: mockBoardCategories[1],
    isLiked: true,
  },
  {
    id: 'thread-3',
    tenantId: 'tenant-1',
    categoryId: 'cat-3',
    authorId: 'user-3',
    title: 'Best marketing automation tools?',
    content: `What tools do you recommend for email marketing automation? I'm currently using Mailchimp but looking to explore other options that might have better automation workflows.

Budget: $100-300/month
Audience size: ~5,000 subscribers`,
    pinned: false,
    locked: false,
    solved: false,
    viewCount: 156,
    replyCount: 23,
    likeCount: 19,
    tags: ['email-marketing', 'automation', 'tools'],
    createdAt: new Date('2024-11-11'),
    updatedAt: new Date('2024-11-11'),
    author: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    },
    category: mockBoardCategories[2],
    isLiked: false,
  },
  {
    id: 'thread-4',
    tenantId: 'tenant-1',
    categoryId: 'cat-4',
    authorId: 'user-4',
    title: 'Just hit my first $10k month! 🎉',
    content: `I'm so excited to share this with you all! After 8 months of grinding, I finally hit my first $10k revenue month.

Key things that helped:
- Consistent content creation
- Email list building
- Focusing on one traffic source
- Not giving up when things got tough

Thank you all for the support and motivation! Happy to answer any questions.`,
    pinned: false,
    locked: false,
    solved: false,
    viewCount: 423,
    replyCount: 34,
    likeCount: 87,
    tags: ['milestone', 'revenue', 'success'],
    createdAt: new Date('2024-11-10'),
    updatedAt: new Date('2024-11-10'),
    author: {
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    },
    category: mockBoardCategories[3],
    isLiked: true,
  },
]

// Mock Thread Detail (with replies)
export const mockThreadDetail = {
  thread: mockBoardThreads[1],
  replies: [
    {
      id: 'reply-1',
      tenantId: 'tenant-1',
      threadId: 'thread-2',
      authorId: 'user-5',
      content: `I use express-rate-limit and it works great! Here's my basic config:

\`\`\`javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
\`\`\``,
      markedAsSolution: true,
      edited: false,
      likeCount: 5,
      createdAt: new Date('2024-11-12T10:30:00'),
      updatedAt: new Date('2024-11-12T10:30:00'),
      author: {
        name: 'David Lee',
        email: 'david@example.com',
        image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
      },
      isLiked: false,
      nestedReplies: [
        {
          id: 'reply-2',
          parentReplyId: 'reply-1',
          content: 'Thanks! That\'s exactly what I needed. How do you handle Redis integration?',
          likeCount: 2,
          createdAt: new Date('2024-11-12T11:00:00'),
          author: {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
          },
        },
      ],
    },
  ],
  category: mockBoardCategories[1],
}


