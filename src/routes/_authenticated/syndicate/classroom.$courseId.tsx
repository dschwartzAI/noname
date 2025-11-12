"use client"

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, BookOpen, Clock, Users, Play } from 'lucide-react'
import { CourseModuleTree } from '@/components/lms/courses/course-module-tree'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId')({
  component: CoursePage
})

function CoursePage() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/courses/${courseId}`)
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        // Use mock data if API is not available
        const { mockCourseDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockCourseDetail
      }
    }
  })

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/courses/${courseId}/enroll`, { method: 'POST' })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', courseId] })
  })

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container max-w-6xl py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Course not found</p>
        </div>
      </div>
    )
  }

  const { course, modules, enrollment, stats } = data
  const completedLessons = enrollment?.completedLessons || []
  const isEnrolled = !!enrollment

  const handleLessonClick = (lessonId: string) => {
    navigate({ 
      to: '/syndicate/classroom/$courseId/$lessonId', 
      params: { courseId, lessonId } 
    })
  }

  const handleStartCourse = () => {
    if (!isEnrolled) {
      enrollMutation.mutate()
    } else if (enrollment.lastAccessedLessonId) {
      navigate({ 
        to: '/syndicate/classroom/$courseId/$lessonId', 
        params: { courseId, lessonId: enrollment.lastAccessedLessonId } 
      })
    } else if (modules.length > 0 && modules[0].lessons.length > 0) {
      handleLessonClick(modules[0].lessons[0].id)
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
        <span className="font-medium text-foreground">{course.title}</span>
      </div>

      {/* Course Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Thumbnail */}
            {course.thumbnail && (
              <div className="relative w-full lg:w-80 h-48 rounded-lg overflow-hidden flex-shrink-0">
                <img 
                  src={course.thumbnail} 
                  alt={course.title} 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}

            {/* Course Info */}
            <div className="flex-1 space-y-4">
              <div>
                <CardTitle className="text-3xl mb-2">{course.title}</CardTitle>
                {course.tier === 'pro' && (
                  <Badge className="mb-2">Pro</Badge>
                )}
                <p className="text-muted-foreground">{course.description}</p>
              </div>

              {/* Instructor */}
              <div className="flex items-center gap-3">
                {course.instructorAvatar ? (
                  <img 
                    src={course.instructorAvatar} 
                    alt={course.instructor} 
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
                    {course.instructor.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{course.instructor}</p>
                  {course.instructorBio && (
                    <p className="text-sm text-muted-foreground">{course.instructorBio}</p>
                  )}
                </div>
              </div>

              {/* Course Stats */}
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {stats?.moduleCount || modules.length} modules
                </span>
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  {stats?.lessonCount || 0} lessons
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {stats?.totalDuration ? `${Math.round(stats.totalDuration / 3600)}h ${Math.round((stats.totalDuration % 3600) / 60)}m` : 'N/A'}
                </span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {course.enrollmentCount || 0} enrolled
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Progress */}
        {isEnrolled && enrollment && (
          <CardContent className="border-t">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Your Progress</span>
                <span className="text-muted-foreground">
                  {enrollment.progressPercentage}% complete
                </span>
              </div>
              <Progress value={enrollment.progressPercentage} className="h-2" />
            </div>
          </CardContent>
        )}

        {/* CTA */}
        <CardContent className={isEnrolled ? "border-t" : ""}>
          <Button 
            size="lg" 
            className="w-full sm:w-auto"
            onClick={handleStartCourse}
            disabled={enrollMutation.isPending}
          >
            {enrollMutation.isPending ? 'Enrolling...' : 
             !isEnrolled ? 'Enroll in Course' :
             enrollment.progressPercentage === 100 ? 'Review Course' :
             enrollment.lastAccessedLessonId ? 'Continue Learning' :
             'Start Course'}
          </Button>
        </CardContent>
      </Card>

      {/* Course Content */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Course Content</h2>
        <CourseModuleTree
          modules={modules}
          completedLessons={completedLessons}
          onLessonClick={handleLessonClick}
        />
      </div>
    </div>
  )
}
