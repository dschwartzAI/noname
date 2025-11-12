"use client"

import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate, Outlet, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId')({
  component: CoursePage
})

function CoursePage() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const hasNavigatedRef = useRef(false)
  
  // Check if we're on a lesson route by checking if the pathname has a lessonId segment
  // Path structure: /syndicate/classroom/course-1/lesson-1
  const pathname = routerState.location.pathname
  const pathParts = pathname.split('/').filter(Boolean)
  // pathParts: ['syndicate', 'classroom', 'course-1', 'lesson-1'] when on lesson route
  // pathParts: ['syndicate', 'classroom', 'course-1'] when on course route only
  const isOnLessonRoute = pathParts.length >= 4 && pathParts[3] && pathParts[3] !== courseId
  
  // If we're on a lesson route, ONLY render the child route (no loading message)
  if (isOnLessonRoute) {
    return <Outlet />
  }

  const { data, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/courses/${courseId}`)
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        const { mockCourseDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockCourseDetail
      }
    }
  })

  // Reset navigation flag when courseId changes
  useEffect(() => {
    hasNavigatedRef.current = false
  }, [courseId])

  // Auto-navigate to first lesson when data loads (only once per course)
  useEffect(() => {
    // Skip if already on lesson route or already navigated
    if (isOnLessonRoute || hasNavigatedRef.current) {
      return
    }

    if (data && data.modules && data.modules.length > 0) {
      const firstLesson = data.modules[0]?.lessons[0]
      if (firstLesson) {
        hasNavigatedRef.current = true
        console.log('Navigating to first lesson:', firstLesson.id)
        
        navigate({ 
          to: '/syndicate/classroom/$courseId/$lessonId', 
          params: { courseId, lessonId: firstLesson.id },
          replace: true
        }).catch((err) => {
          console.error('Navigation failed:', err)
          hasNavigatedRef.current = false // Reset on error so we can retry
        })
      }
    }
  }, [data, courseId, navigate, isOnLessonRoute])

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-80 border-r">
          <Skeleton className="h-full" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-full" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Course not found</p>
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: '/syndicate/classroom' })}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Classroom
          </Button>
        </div>
      </div>
    )
  }

  const { modules } = data
  
  // Check if there are any lessons
  const firstLesson = modules[0]?.lessons[0]
  
  if (!firstLesson) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No lessons available</p>
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: '/syndicate/classroom' })}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Classroom
          </Button>
        </div>
      </div>
    )
  }

  // Show loading while navigating to first lesson
  // Note: This should only show briefly before navigation happens
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Skeleton className="h-8 w-48 mx-auto" />
        <p className="text-muted-foreground mt-4">Loading lesson...</p>
      </div>
    </div>
  )
}
