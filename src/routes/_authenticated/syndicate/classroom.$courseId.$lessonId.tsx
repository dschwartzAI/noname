"use client"

import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId/$lessonId')({
  component: LessonPage
})

function LessonPage() {
  const { lessonId } = Route.useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/lessons/${lessonId}`)
      return res.json()
    }
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/v1/courses/lessons/${lessonId}/complete`, { method: 'POST' })
    }
  })

  if (isLoading) return <div className="container py-6"><Skeleton className="h-96" /></div>

  const { lesson, progress } = data

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <Card className="overflow-hidden">
        {lesson.videoUrl && (
          <div className="aspect-video bg-black">
            <video src={lesson.videoUrl} controls className="w-full h-full" />
          </div>
        )}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{lesson.title}</h1>
              <p className="text-muted-foreground mt-2">{lesson.description}</p>
            </div>
            {!progress?.completed && (
              <Button onClick={() => completeMutation.mutate()} className="shrink-0">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>

          {lesson.transcript && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Transcript</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lesson.transcript}</p>
            </div>
          )}

          {lesson.resources && lesson.resources.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Resources</h3>
              <div className="space-y-2">
                {lesson.resources.map((resource: any) => (
                  <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    📄 {resource.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
