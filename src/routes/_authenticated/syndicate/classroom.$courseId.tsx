"use client"

import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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

  // Auto-navigate to first lesson when data loads
  useEffect(() => {
    console.log('useEffect triggered, data:', data)
    if (data && data.modules && data.modules.length > 0) {
      const firstLesson = data.modules[0]?.lessons[0]
      console.log('First lesson found:', firstLesson)
      if (firstLesson) {
        const targetRoute = '/syndicate/classroom/$courseId/$lessonId'
        const targetParams = { courseId, lessonId: firstLesson.id }
        console.log('Navigating to:', targetRoute, 'with params:', targetParams)
        
        navigate({ 
          to: targetRoute, 
          params: targetParams,
          replace: true
        }).then(() => {
          console.log('Navigation completed successfully')
        }).catch((err) => {
          console.error('Navigation failed:', err)
        })
      }
    } else {
      console.log('No data or modules:', { hasData: !!data, hasModules: data?.modules?.length })
    }
  }, [data, courseId, navigate])

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

  // Show loading while navigating
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Skeleton className="h-8 w-48 mx-auto" />
        <p className="text-muted-foreground mt-4">Loading lesson...</p>
      </div>
    </div>
  )
}
