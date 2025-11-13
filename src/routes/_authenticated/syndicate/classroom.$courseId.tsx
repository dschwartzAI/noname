"use client"

import { createFileRoute, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId')({
  component: CoursePage
})

function CoursePage() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const hasRedirectedRef = useRef(false)
  
  // Check if we're on a lesson route by checking if the pathname has a lessonId segment
  // Path structure: /syndicate/classroom/course-1/lesson-1
  const pathname = routerState.location.pathname
  const pathParts = pathname.split('/').filter(Boolean)
  // pathParts: ['syndicate', 'classroom', 'course-1', 'lesson-1'] when on lesson route
  // pathParts: ['syndicate', 'classroom', 'course-1'] when on course route only
  const isOnLessonRoute = pathParts.length >= 4 && pathParts[3] && pathParts[3] !== courseId
  
  // Check if we're navigating away from this route
  const isNavigatingAway = !pathname.startsWith('/syndicate/classroom/') || 
    (pathParts.length === 3 && pathParts[2] !== courseId)
  
  // Fetch course data - must be called before any conditional returns (Rules of Hooks)
  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/${courseId}`)
      if (!res.ok) throw new Error('Failed to fetch course')
      return res.json()
    },
    enabled: !isOnLessonRoute && !isNavigatingAway, // Only fetch if not on lesson route and not navigating away
  })
  
  // useEffect must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    // Don't redirect if:
    // 1. Already redirected
    // 2. On lesson route
    // 3. Navigating away
    // 4. No course data yet
    if (hasRedirectedRef.current || isOnLessonRoute || isNavigatingAway || !courseData) {
      return
    }
    
    // Mark that we're redirecting to prevent multiple redirects
    hasRedirectedRef.current = true
    
    // Find first lesson
    const firstModule = courseData.modules?.[0]
    const firstLesson = firstModule?.lessons?.[0]
    
    if (firstLesson) {
      navigate({
        to: '/syndicate/classroom/$courseId/$lessonId',
        params: { courseId, lessonId: firstLesson.id },
        replace: true,
      }).catch((err) => {
        console.error('Navigation error:', err)
        hasRedirectedRef.current = false // Reset on error
      })
    } else {
      // No lessons yet, redirect back to classroom
      navigate({
        to: '/syndicate/classroom',
        replace: true,
      }).catch((err) => {
        console.error('Navigation error:', err)
        hasRedirectedRef.current = false // Reset on error
      })
    }
  }, [courseData, courseId, navigate, isOnLessonRoute, isNavigatingAway])
  
  // Reset redirect flag when courseId changes (navigating to different course)
  useEffect(() => {
    hasRedirectedRef.current = false
  }, [courseId])
  
  // If we're on a lesson route, ONLY render the child route (lesson page)
  if (isOnLessonRoute) {
    return <Outlet />
  }

  // If navigating away, don't try to redirect
  if (isNavigatingAway) {
    return <Outlet />
  }

  // Show loading state while redirecting
  return (
    <div className="container max-w-7xl py-6">
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading course...</p>
      </div>
    </div>
  )
}
