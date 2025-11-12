"use client"

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { CourseCard } from '@/components/lms/courses/course-card'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/syndicate/classroom')({
  component: ClassroomPage
})

function ClassroomPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const res = await fetch('/api/v1/courses')
      return res.json()
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-7xl py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    )
  }

  const courses = data?.courses || []

  // Filter courses
  const filteredCourses = courses.filter((item: any) => {
    const matchesSearch = item.course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.course.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filterTab === 'all') return matchesSearch
    if (filterTab === 'in-progress') return matchesSearch && item.isEnrolled && item.progress > 0 && item.progress < 100
    if (filterTab === 'completed') return matchesSearch && item.isEnrolled && item.progress === 100
    
    return matchesSearch
  })

  const handleCourseClick = (courseId: string) => {
    navigate({ to: '/syndicate/classroom/$courseId', params: { courseId } })
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Classroom</h1>
          <p className="text-muted-foreground mt-2">Browse and continue your courses</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={filterTab} onValueChange={setFilterTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All Courses</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No courses found</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((item: any) => (
            <CourseCard
              key={item.course.id}
              course={item.course}
              moduleCount={item.moduleCount}
              lessonCount={item.lessonCount}
              totalDuration={item.totalDuration}
              enrollment={item.isEnrolled ? {
                progressPercentage: item.progress,
                completedLessons: item.completedLessons || [],
                lastAccessedAt: item.lastAccessedAt
              } : undefined}
              onClick={() => handleCourseClick(item.course.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
