"use client"

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BookOpen, Clock, Users } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/syndicate/classroom')({
  component: ClassroomPage
})

function ClassroomPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const res = await fetch('/api/v1/courses')
      return res.json()
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    )
  }

  const courses = data?.courses || []

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Classroom</h1>
        <p className="text-muted-foreground mt-2">Browse and continue your courses</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((item: any) => (
          <Link key={item.course.id} to="/syndicate/classroom/$courseId" params={{ courseId: item.course.id }}>
            <Card className="hover:shadow-lg transition-shadow h-full">
              {item.course.thumbnail && (
                <img src={item.course.thumbnail} alt={item.course.title} className="w-full h-40 object-cover rounded-t-lg" />
              )}
              <CardHeader className="pb-3">
                <CardTitle className="line-clamp-2">{item.course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{item.course.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {item.lessonCount} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {item.course.enrollmentCount}
                  </span>
                </div>
                {item.isEnrolled ? (
                  <>
                    <Progress value={item.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{item.progress}% complete</p>
                  </>
                ) : (
                  <Badge variant="secondary">{item.course.tier}</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
