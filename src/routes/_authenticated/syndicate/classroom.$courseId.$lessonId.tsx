"use client"

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  Download 
} from 'lucide-react'
import { VideoPlayer } from '@/components/lms/courses/video-player'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId/$lessonId')({
  component: LessonPage
})

function LessonPage() {
  const { courseId, lessonId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/courses/lessons/${lessonId}`)
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        // Use mock data if API is not available
        const { mockLessonDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockLessonDetail
      }
    }
  })

  const updateProgressMutation = useMutation({
    mutationFn: async ({ position, percentage }: { position: number, percentage: number }) => {
      await fetch(`/api/v1/courses/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position, percentage })
      })
    }
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/v1/courses/lessons/${lessonId}/complete`, { method: 'POST' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] })
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6">
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  const { lesson, progress, navigation, course } = data

  const handleProgress = (position: number, percentage: number) => {
    updateProgressMutation.mutate({ position, percentage })
    
    // Auto-complete at 90%
    if (percentage >= 90 && !progress?.completed) {
      completeMutation.mutate()
    }
  }

  const handleNavigation = (direction: 'prev' | 'next') => {
    const targetLessonId = direction === 'prev' ? navigation.previousLessonId : navigation.nextLessonId
    if (targetLessonId) {
      navigate({
        to: '/syndicate/classroom/$courseId/$lessonId',
        params: { courseId, lessonId: targetLessonId }
      })
    }
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/syndicate' })}
          className="h-auto p-0 hover:text-foreground"
        >
          Syndicate
        </Button>
        <span>/</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/syndicate/classroom' })}
          className="h-auto p-0 hover:text-foreground"
        >
          Classroom
        </Button>
        <span>/</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/syndicate/classroom/$courseId', params: { courseId } })}
          className="h-auto p-0 hover:text-foreground"
        >
          {course?.title || 'Course'}
        </Button>
        <span>/</span>
        <span className="font-medium text-foreground">{lesson.title}</span>
      </div>

      {/* Video Player */}
      <Card className="overflow-hidden">
        {lesson.videoUrl ? (
          <VideoPlayer
            videoUrl={lesson.videoUrl}
            videoProvider={lesson.videoProvider}
            initialPosition={progress?.lastWatchPosition || 0}
            onProgress={handleProgress}
            onComplete={() => !progress?.completed && completeMutation.mutate()}
          />
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">No video available</p>
          </div>
        )}

        {/* Lesson Info */}
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">{lesson.title}</CardTitle>
                {progress?.completed && (
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              {lesson.description && (
                <p className="text-muted-foreground">{lesson.description}</p>
              )}
            </div>
            {!progress?.completed && (
              <Button 
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Transcript */}
        {lesson.transcript && (
          <CardContent className="border-t">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transcript
                </h3>
              </div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto p-4 bg-muted/50 rounded-lg">
                {lesson.transcript}
              </div>
            </div>
          </CardContent>
        )}

        {/* Resources */}
        {lesson.resources && lesson.resources.length > 0 && (
          <CardContent className="border-t">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" />
                Resources
              </h3>
              <div className="grid gap-2">
                {lesson.resources.map((resource: any) => (
                  <a 
                    key={resource.id} 
                    href={resource.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-blue-600 transition-colors">
                        {resource.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {resource.type}
                      </p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => handleNavigation('prev')}
          disabled={!navigation.previousLessonId}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Lesson
        </Button>
        
        <Button
          onClick={() => handleNavigation('next')}
          disabled={!navigation.nextLessonId}
          className="gap-2"
        >
          Next Lesson
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
