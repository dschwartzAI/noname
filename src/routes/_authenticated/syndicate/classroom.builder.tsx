"use client"

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CourseBuilder } from '@/components/lms/courses/course-builder'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/builder')({
  component: CourseBuilderPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      courseId: (search.courseId as string) || undefined,
    }
  },
})

function CourseBuilderPage() {
  const navigate = useNavigate()
  const { courseId } = Route.useSearch()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(true)
  const [createdCourseId, setCreatedCourseId] = useState<string | undefined>(courseId)

  // Fetch course if editing
  const { data: course } = useQuery({
    queryKey: ['course', createdCourseId],
    queryFn: async () => {
      if (!createdCourseId) return null
      const res = await fetch(`/api/v1/courses/${createdCourseId}`)
      if (!res.ok) throw new Error('Failed to fetch course')
      const courseData = await res.json()
      // Return only course-level fields, not modules/lessons
      return {
        id: courseData.id,
        title: courseData.title,
        description: courseData.description,
        thumbnail: courseData.thumbnail,
        category: courseData.category,
        instructorId: courseData.instructorId,
        instructor: courseData.instructor,
        instructorBio: courseData.instructorBio,
        instructorAvatar: courseData.instructorAvatar,
        tier: courseData.tier,
        published: courseData.published,
        order: courseData.order,
      }
    },
    enabled: !!createdCourseId,
  })

  const handleClose = () => {
    setIsOpen(false)
    navigate({ to: '/syndicate/classroom' })
  }

  const handleSave = async (courseId?: string) => {
    // If a new course was created, set the course ID
    if (courseId && !createdCourseId) {
      setCreatedCourseId(courseId)
    }
    // Invalidate queries to refresh course list
    queryClient.invalidateQueries({ queryKey: ['courses'] })
    queryClient.invalidateQueries({ queryKey: ['course', courseId || createdCourseId] })
  }

  return (
    <CourseBuilder
      course={course || undefined}
      isOpen={isOpen}
      onClose={handleClose}
      onSave={handleSave}
    />
  )
}

