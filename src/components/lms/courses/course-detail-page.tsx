"use client"

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Edit, PlayCircle, BookOpen, Clock, Users, CheckCircle2, ChevronRight } from 'lucide-react'
import { CourseModuleTree } from './course-module-tree'
import { useAuth } from '@/stores/auth-simple'
import { CourseBuilder } from './course-builder'

interface CourseDetailPageProps {
  courseId: string
}

export function CourseDetailPage({ courseId }: CourseDetailPageProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Fetch organization to check role
  const { data: orgData } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current')
      if (!res.ok) return null
      return res.json()
    },
  })

  const organizationRole = orgData?.organization?.role
  const isOwner = organizationRole === 'owner' || user?.isGod
  const canEdit = isOwner

  // Fetch course data
  const { data: courseData, isLoading } = useQuery({
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
    },
  })

  if (isLoading || !courseData) {
    return (
      <div className="container max-w-7xl py-6 space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const course = courseData
  const modules = course.modules || []
  
  // Calculate stats
  const totalLessons = modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0)
  const totalDuration = modules.reduce((sum: number, m: any) => {
    return sum + (m.lessons?.reduce((lessonSum: number, l: any) => lessonSum + (l.duration || 0), 0) || 0)
  }, 0)

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Find first lesson
  const firstLesson = modules[0]?.lessons?.[0]

  const handleStartCourse = () => {
    if (firstLesson) {
      navigate({
        to: '/syndicate/classroom/$courseId/$lessonId',
        params: { courseId, lessonId: firstLesson.id },
      })
    }
  }

  const handleLessonClick = (lessonId: string) => {
    navigate({
      to: '/syndicate/classroom/$courseId/$lessonId',
      params: { courseId, lessonId },
    })
  }

  const handleEdit = () => {
    setIsEditDialogOpen(true)
  }

  return (
    <>
      <div className="container max-w-7xl py-6 space-y-6">
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
          <span className="font-medium text-foreground">{course.title}</span>
        </div>

        {/* Course Header */}
        <div className="space-y-6">
          {/* Back Button */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/syndicate/classroom' })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classroom
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Course
              </Button>
            )}
          </div>

          {/* Course Banner */}
          {course.thumbnail && (
            <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-full h-full object-cover"
              />
              {course.tier === 'pro' && (
                <Badge className="absolute top-4 right-4" variant="default">
                  Pro
                </Badge>
              )}
            </div>
          )}

          {/* Course Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold">{course.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                {course.instructorAvatar ? (
                  <img
                    src={course.instructorAvatar}
                    alt={course.instructor}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {course.instructor.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">by</p>
                  <p className="font-semibold">{course.instructor}</p>
                </div>
              </div>
            </div>

            {course.description && (
              <p className="text-lg text-muted-foreground max-w-3xl">
                {course.description}
              </p>
            )}

            {course.instructorBio && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">About the Instructor</p>
                <p className="text-sm text-muted-foreground">{course.instructorBio}</p>
              </div>
            )}

            {/* Course Stats */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <span>{modules.length} {modules.length === 1 ? 'Module' : 'Modules'}</span>
              </div>
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                <span>{totalLessons} {totalLessons === 1 ? 'Lesson' : 'Lessons'}</span>
              </div>
              {totalDuration > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span>{formatDuration(totalDuration)}</span>
                </div>
              )}
              {course.enrollmentCount > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{course.enrollmentCount} enrolled</span>
                </div>
              )}
            </div>

            {/* CTA Button */}
            {firstLesson && (
              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleStartCourse}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Course
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Modules Section */}
        {modules.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Course Content</h2>
            <CourseModuleTree
              modules={modules}
              onLessonClick={handleLessonClick}
            />
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No modules available yet.</p>
            {canEdit && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                Add Modules
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {canEdit && (
        <CourseBuilder
          course={course}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={() => {
            setIsEditDialogOpen(false)
            // Refetch course data
            window.location.reload()
          }}
        />
      )}
    </>
  )
}

