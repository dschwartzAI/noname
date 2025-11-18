"use client"

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, Plus } from 'lucide-react'
import { CourseCard } from '@/components/lms/courses/course-card'
import { useState, useMemo } from 'react'
import { useAuth } from '@/stores/auth-simple'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/')({
  component: ClassroomPage
})

function ClassroomPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [courseToDelete, setCourseToDelete] = useState<any>(null)

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

  const { data, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/courses')
        if (!res.ok) throw new Error('API not available')
        return res.json()
      } catch (error) {
        // Use mock data if API is not available
        const { mockCourses } = await import('@/lib/mock-data/lms-mock-data')
        return { courses: mockCourses }
      }
    }
  })

  const courses = data?.courses || []

  // Extract unique categories - MUST be called before any conditional returns
  const categories = useMemo(() => {
    const cats = new Set<string>()
    courses.forEach((item: any) => {
      const courseCategories = item.course?.categories || []
      courseCategories.forEach((cat: string) => {
        if (cat) cats.add(cat)
      })
    })
    return Array.from(cats).sort()
  }, [courses])

  // Delete course mutation - MUST be before any conditional returns
  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const res = await fetch(`/api/v1/courses/${courseId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to delete course')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course deleted successfully')
      setCourseToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete course')
    },
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

  // Filter courses
  const filteredCourses = courses.filter((item: any) => {
    const matchesSearch = item.course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.course.instructor?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const courseCategories = item.course.categories || []
    const matchesCategory = selectedCategory === 'all' || courseCategories.includes(selectedCategory)
    
    return matchesSearch && matchesCategory
  })

  const handleCourseClick = async (courseId: string) => {
    // Fetch course to get first lesson
    try {
      const res = await fetch(`/api/v1/courses/${courseId}`)
      if (!res.ok) throw new Error('Failed to fetch course')
      const course = await res.json()
      
      // Find first lesson
      const firstModule = course.modules?.[0]
      const firstLesson = firstModule?.lessons?.[0]
      
      if (firstLesson) {
        navigate({
          to: '/syndicate/classroom/$courseId/$lessonId',
          params: { courseId, lessonId: firstLesson.id },
        })
      } else {
        // No lessons yet, navigate to course detail
        navigate({ to: '/syndicate/classroom/$courseId', params: { courseId } })
      }
    } catch (error) {
      console.error('Error fetching course:', error)
      navigate({ to: '/syndicate/classroom/$courseId', params: { courseId } })
    }
  }

  const handleEditCourse = async (course: any) => {
    // Navigate to builder page with courseId
    navigate({
      to: '/syndicate/classroom/builder',
      search: { courseId: course.id }
    })
  }

  const handleDeleteCourse = (course: any) => {
    setCourseToDelete(course)
  }

  const confirmDelete = () => {
    if (courseToDelete) {
      deleteMutation.mutate(courseToDelete.id)
    }
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
            className="h-auto px-2 py-1 hover:text-foreground"
          >
            Syndicate
          </Button>
          <span>/</span>
          <span className="font-medium text-foreground">Classroom</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Training Courses</h1>
            <p className="text-muted-foreground mt-2">Access all training courses to build your sovereign business</p>
          </div>
          {canEdit && (
            <Button
              onClick={() => navigate({ to: '/syndicate/classroom/builder' })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Course
            </Button>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="category-filter" className="text-sm">Category:</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category-filter" className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.length > 0 ? (
                    categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="all" disabled>No categories yet</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((item: any) => (
              <CourseCard
                key={item.course.id}
                course={item.course}
                onClick={() => handleCourseClick(item.course.id)}
                onEdit={() => handleEditCourse(item.course)}
                onDelete={() => handleDeleteCourse(item.course)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!courseToDelete} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course "{courseToDelete?.title}" and all its content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
