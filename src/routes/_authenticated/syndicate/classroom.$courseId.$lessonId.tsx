"use client"

import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ChevronRight, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { VideoPlayer } from '@/components/lms/courses/video-player'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId/$lessonId')({
  component: LessonPage
})

function LessonPage() {
  const { courseId, lessonId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [contentOpen, setContentOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  // Fetch course data
  const { data: courseData } = useQuery({
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

  // Fetch lesson data
  const { data: lessonData, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/courses/lessons/${lessonId}`)
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        const { mockLessonDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockLessonDetail
      }
    }
  })

  const updateProgressMutation = useMutation({
    mutationFn: async (progress: number) => {
      const res = await fetch(`/api/v1/courses/lessons/${lessonId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      })
      return res.json()
    }
  })

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/courses/lessons/${lessonId}/complete`, {
        method: 'POST'
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
    }
  })

  if (isLoading || !courseData || !lessonData) {
    return (
      <div className="flex h-screen">
        <div className="w-80 border-r bg-muted/30">
          <Skeleton className="h-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  const { course, modules, enrollment } = courseData
  const { lesson } = lessonData
  const completedLessons = enrollment?.completedLessons || []

  // Find current lesson's module and next lesson
  let currentModuleIndex = -1
  let currentLessonIndex = -1
  let nextLesson = null

  for (let i = 0; i < modules.length; i++) {
    const lessonIdx = modules[i].lessons.findIndex((l: any) => l.id === lessonId)
    if (lessonIdx !== -1) {
      currentModuleIndex = i
      currentLessonIndex = lessonIdx
      
      // Check if there's a next lesson in current module
      if (lessonIdx < modules[i].lessons.length - 1) {
        nextLesson = modules[i].lessons[lessonIdx + 1]
      } else if (i < modules.length - 1 && modules[i + 1].lessons.length > 0) {
        // Check first lesson of next module
        nextLesson = modules[i + 1].lessons[0]
      }
      break
    }
  }

  const handleLessonClick = (newLessonId: string) => {
    navigate({
      to: '/syndicate/classroom/$courseId/$lessonId',
      params: { courseId, lessonId: newLessonId }
    })
  }

  const handleNextLesson = () => {
    if (nextLesson) {
      markCompleteMutation.mutate()
      handleLessonClick(nextLesson.id)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col overflow-hidden">
        {/* Back Button */}
        <div className="p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/syndicate/classroom' })}
            className="w-full justify-start"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Course Title */}
        <div className="p-4 border-b bg-background">
          <h2 className="font-semibold text-sm line-clamp-2">{course.title}</h2>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
        </div>

        {/* Module & Lesson List */}
        <div className="flex-1 overflow-y-auto">
          {modules.map((module: any, moduleIdx: number) => (
            <Collapsible key={module.id} defaultOpen={moduleIdx === currentModuleIndex}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{moduleIdx + 1}. {module.title}</p>
                  <p className="text-xs text-muted-foreground">
                    ({module.lessons.length} {module.lessons.length === 1 ? 'lesson' : 'lessons'})
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {module.lessons.map((lessonItem: any) => {
                  const isActive = lessonItem.id === lessonId
                  const isCompleted = completedLessons.includes(lessonItem.id)
                  
                  return (
                    <button
                      key={lessonItem.id}
                      onClick={() => handleLessonClick(lessonItem.id)}
                      className={`w-full text-left px-4 py-3 pl-8 hover:bg-muted/50 transition-colors border-l-2 ${
                        isActive ? 'bg-primary/10 border-primary' : 'border-transparent'
                      }`}
                    >
                      <p className={`text-sm ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {lessonItem.title}
                      </p>
                      {isCompleted && (
                        <p className="text-xs text-green-600 mt-1">✓ Completed</p>
                      )}
                    </button>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Add Module/Section Buttons */}
        <div className="p-4 border-t bg-background space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            + Module
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            + Section
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Lesson Title */}
          <div>
            <h1 className="text-3xl font-bold">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-muted-foreground mt-2">{lesson.description}</p>
            )}
          </div>

          {/* Video Player */}
          <div className="relative w-full bg-black rounded-lg overflow-hidden">
            <VideoPlayer
              videoUrl={lesson.videoUrl}
              videoProvider={lesson.videoProvider}
              onProgress={(progress) => updateProgressMutation.mutate(progress)}
            />
          </div>

          {/* Ask Instructor Button */}
          <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
            <MessageCircle className="mr-2 h-5 w-5" />
            Ask {course.instructor} about this module
          </Button>

          {/* Content Section */}
          <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <span className="font-semibold">Content</span>
              </div>
              {contentOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4">
              {lesson.content ? (
                <div className="prose dark:prose-invert max-w-none">
                  <p>{lesson.content}</p>
                </div>
              ) : (
                <button className="text-primary hover:underline text-sm">Show more</button>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Resources Section */}
          <Collapsible open={resourcesOpen} onOpenChange={setResourcesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">📎</span>
                <span className="font-semibold">Resources</span>
              </div>
              {resourcesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4">
              {lesson.resources && lesson.resources.length > 0 ? (
                <ul className="space-y-2">
                  {lesson.resources.map((resource: any, idx: number) => (
                    <li key={idx}>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-2">
                        <span>🔗</span>
                        {resource.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No resources available</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Transcript Section */}
          <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭕</span>
                <span className="font-semibold">Transcript</span>
              </div>
              {transcriptOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4">
              {lesson.transcript ? (
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <p className="whitespace-pre-wrap">{lesson.transcript}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No transcript available</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Next Lesson Button */}
          {nextLesson && (
            <div className="flex justify-end pt-6">
              <Button
                size="lg"
                onClick={handleNextLesson}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                NEXT LESSON
                <div className="ml-2 text-sm font-normal">{nextLesson.title}</div>
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
