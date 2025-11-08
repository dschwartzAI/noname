"use client"

import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { CheckCircle2, Circle, PlayCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId')({
  component: CoursePage
})

function CoursePage() {
  const { courseId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/${courseId}`)
      return res.json()
    }
  })

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/courses/${courseId}/enroll`, { method: 'POST' })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', courseId] })
  })

  if (isLoading) return <div className="container py-6"><Skeleton className="h-96" /></div>

  const { course, modules, enrollment } = data
  const completedLessons = enrollment?.completedLessons || []

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {course.thumbnail && (
              <img src={course.thumbnail} alt={course.title} className="w-full md:w-48 h-32 object-cover rounded-lg" />
            )}
            <div className="flex-1">
              <CardTitle className="text-2xl">{course.title}</CardTitle>
              <p className="text-muted-foreground mt-2">{course.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <img src={course.instructorAvatar || '/placeholder.svg'} alt={course.instructor} className="h-8 w-8 rounded-full" />
                <span className="text-sm">{course.instructor}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        {enrollment && (
          <CardContent>
            <Progress value={enrollment.progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{enrollment.progressPercentage}% complete</p>
          </CardContent>
        )}
      </Card>

      {!enrollment && (
        <Button onClick={() => enrollMutation.mutate()} className="w-full md:w-auto">Enroll in Course</Button>
      )}

      <Accordion type="multiple" className="space-y-4">
        {modules.map((module: any, idx: number) => {
          const moduleLessons = module.lessons || []
          const completedCount = moduleLessons.filter((l: any) => completedLessons.includes(l.id)).length
          
          return (
            <AccordionItem key={module.id} value={module.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-sm font-semibold text-muted-foreground">Module {idx + 1}</span>
                  <span className="font-semibold">{module.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{completedCount}/{moduleLessons.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-4">
                {moduleLessons.map((lesson: any) => {
                  const isCompleted = completedLessons.includes(lesson.id)
                  return (
                    <a key={lesson.id} href={`/syndicate/classroom/${courseId}/${lesson.id}`}>
                      <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-3 py-3">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-medium", isCompleted && "text-muted-foreground")}>{lesson.title}</p>
                            {lesson.duration && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {Math.round(lesson.duration / 60)} min
                              </p>
                            )}
                          </div>
                          <PlayCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    </a>
                  )
                })}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
