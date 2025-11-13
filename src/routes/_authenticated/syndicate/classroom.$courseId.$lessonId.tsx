"use client"

import { useState, useMemo, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ChevronRight, ChevronDown, ChevronUp, MessageCircle, Edit, GripVertical, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { VideoPlayer } from '@/components/lms/courses/video-player'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/stores/auth-simple'
import { LessonEditor } from '@/components/lms/courses/lesson-editor'
import { ModuleEditor } from '@/components/lms/courses/module-editor'
import { LessonCreator } from '@/components/lms/courses/lesson-creator'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export const Route = createFileRoute('/_authenticated/syndicate/classroom/$courseId/$lessonId')({
  component: LessonPage
})

function LessonPage() {
  const { courseId, lessonId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [inlineEditingModuleId, setInlineEditingModuleId] = useState<string | null>(null)
  const [isLessonCreatorOpen, setIsLessonCreatorOpen] = useState(false)
  const [defaultModuleId, setDefaultModuleId] = useState<string | undefined>(undefined)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

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
  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/${courseId}`)
      if (!res.ok) {
        // API not available, use mock data
        const { mockCourseDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockCourseDetail
      }
      return res.json()
    },
    retry: false, // Don't retry failed requests
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  // Fetch lesson data
  const { data: lessonData, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/lessons/${lessonId}`)
      if (!res.ok) {
        // API not available, use mock data
        const { mockLessonDetail } = await import('@/lib/mock-data/lms-mock-data')
        return mockLessonDetail
      }
      return res.json()
    },
    retry: false, // Don't retry failed requests
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
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

  const reorderMutation = useMutation({
    mutationFn: async (data: { modules?: Array<{ id: string; order: number }>, lessons?: Array<{ id: string; moduleId: string; order: number }> }) => {
      const res = await fetch(`/api/v1/courses/${courseId}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reorder')
      }
      return res.json()
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['course', courseId] })

      // Snapshot the previous value
      const previousCourseData = queryClient.getQueryData(['course', courseId])

      // Optimistically update the cache
      queryClient.setQueryData(['course', courseId], (old: any) => {
        if (!old) return old

        const updated = { ...old }
        
        // Update module orders
        if (data.modules && updated.modules) {
          updated.modules = updated.modules.map((mod: any) => {
            const orderUpdate = data.modules?.find((m) => m.id === mod.id)
            if (orderUpdate) {
              return { ...mod, order: orderUpdate.order }
            }
            return mod
          }).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        }

        // Update lesson orders and module assignments
        if (data.lessons && updated.modules) {
          // Group lesson updates by their target module
          const lessonsByModule = new Map<string, Array<{ id: string; moduleId: string; order: number }>>()
          data.lessons.forEach((l) => {
            if (!lessonsByModule.has(l.moduleId)) {
              lessonsByModule.set(l.moduleId, [])
            }
            lessonsByModule.get(l.moduleId)!.push(l)
          })

          // Create a map of lesson updates for quick lookup
          const lessonUpdates = new Map(data.lessons.map(l => [l.id, l]))

          updated.modules = updated.modules.map((mod: any) => {
            const moduleLessons = mod.lessons || []
            
            // Remove lessons that are being moved to other modules
            const remainingLessons = moduleLessons.filter((les: any) => {
              const update = lessonUpdates.get(les.id)
              return !update || update.moduleId === mod.id
            })

            // Add lessons that are being moved to this module
            const incomingLessons = lessonsByModule.get(mod.id) || []
            const newLessons = incomingLessons
              .filter(({ id }) => !remainingLessons.some((l: any) => l.id === id))
              .map(({ id, order }) => {
                // Find the lesson data from other modules
                for (const m of updated.modules) {
                  const found = (m.lessons || []).find((l: any) => l.id === id)
                  if (found) return { ...found, moduleId: mod.id, order }
                }
                return null
              })
              .filter(Boolean)

            // Update orders for remaining lessons
            const updatedLessons = remainingLessons.map((les: any) => {
              const orderUpdate = lessonUpdates.get(les.id)
              if (orderUpdate && orderUpdate.moduleId === mod.id) {
                return { ...les, order: orderUpdate.order, moduleId: mod.id }
              }
              return les
            })

            // Combine and sort
            const allLessons = [...updatedLessons, ...newLessons]
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))

            return { ...mod, lessons: allLessons }
          })
        }

        return updated
      })

      // Return context with snapshot value
      return { previousCourseData }
    },
    onError: (err, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousCourseData) {
        queryClient.setQueryData(['course', courseId], context.previousCourseData)
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // API returns course object directly with modules property
  // Move useMemo before early return to follow Rules of Hooks
  const modules = useMemo(() => {
    if (!courseData) return []
    const mods = courseData?.modules || []
    return mods.map((mod: any) => ({
      ...mod,
      lessons: (mod.lessons || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    })).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
  }, [courseData])

  // Define all mutations before early returns to follow Rules of Hooks
  const createModuleMutation = useMutation({
    mutationFn: async () => {
      // Calculate order for new module: max order + 1 (add to bottom)
      const maxOrder = modules.length > 0 
        ? Math.max(...modules.map((m: any) => m.order ?? 0))
        : -1
      
      const res = await fetch('/api/v1/courses/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: 'New Section',
          description: undefined,
          order: maxOrder + 1,
          published: false,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create section')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      // Set the newly created module to inline edit mode
      if (data.module?.id) {
        setInlineEditingModuleId(data.module.id)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create section')
    },
  })

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/v1/courses/modules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || 'New Section' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update section')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      setInlineEditingModuleId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update section')
    },
  })

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/courses/modules/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete section')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      toast.success('Section deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete section')
    },
  })

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/courses/lessons/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete lesson')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      toast.success('Lesson deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete lesson')
    },
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

  // API returns course object directly with modules property
  const course = courseData
  
  // API returns lesson object directly (spread) with module and course properties
  const lesson = lessonData
  const completedLessons: string[] = []

  // Get all sortable IDs for drag and drop
  const moduleIds = modules.map((m: any) => `module-${m.id}`)
  // Note: We'll handle lesson sorting within each module's SortableContext

  // Safety check - if course or lesson is missing required fields, show error
  if (!course?.title || !lesson?.title) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Course or lesson data is missing</p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/syndicate/classroom' })}
            className="mt-4"
          >
            Back to Classroom
          </Button>
        </div>
      </div>
    )
  }

  // Find current lesson's module and next lesson
  let currentModuleIndex = -1
  let currentLessonIndex = -1
  let nextLesson = null

  for (let i = 0; i < modules.length; i++) {
    const moduleLessons = modules[i]?.lessons || []
    const lessonIdx = moduleLessons.findIndex((l: any) => l.id === lessonId)
    if (lessonIdx !== -1) {
      currentModuleIndex = i
      currentLessonIndex = lessonIdx
      
      // Check if there's a next lesson in current module
      if (lessonIdx < moduleLessons.length - 1) {
        nextLesson = moduleLessons[lessonIdx + 1]
      } else if (i < modules.length - 1) {
        // Check first lesson of next module
        const nextModuleLessons = modules[i + 1]?.lessons || []
        if (nextModuleLessons.length > 0) {
          nextLesson = nextModuleLessons[0]
        }
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    setOverId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    // Handle module reordering
    if (activeId.startsWith('module-') && overId.startsWith('module-')) {
      const activeModuleId = activeId.replace('module-', '')
      const overModuleId = overId.replace('module-', '')
      
      const activeIndex = modules.findIndex((m: any) => m.id === activeModuleId)
      const overIndex = modules.findIndex((m: any) => m.id === overModuleId)

      if (activeIndex !== -1 && overIndex !== -1) {
        const newModules = arrayMove(modules, activeIndex, overIndex)
        const moduleOrders = newModules.map((mod: any, index: number) => ({
          id: mod.id,
          order: index,
        }))
        reorderMutation.mutate({ modules: moduleOrders })
      }
      return
    }

    // Handle lesson dragged onto a module (move to that module)
    if (activeId.startsWith('lesson-') && overId.startsWith('module-')) {
      const activeLessonId = activeId.replace('lesson-', '')
      const targetModuleId = overId.replace('module-', '')

      // Find source module and target module
      let activeModule: any = null
      let targetModule: any = null
      let activeLessonIndex = -1

      for (const mod of modules) {
        const lessons = mod.lessons || []
        const activeIdx = lessons.findIndex((l: any) => l.id === activeLessonId)
        
        if (activeIdx !== -1) {
          activeModule = mod
          activeLessonIndex = activeIdx
        }
        if (mod.id === targetModuleId) {
          targetModule = mod
        }
      }

      if (activeModule && targetModule) {
        const sourceLesson = activeModule.lessons[activeLessonIndex]
        
        // Create lesson orders for both modules
        const allLessonOrders: Array<{ id: string; moduleId: string; order: number }> = []
        
        // Update source module (remove lesson)
        activeModule.lessons
          .filter((l: any) => l.id !== activeLessonId)
          .forEach((l: any, idx: number) => {
            allLessonOrders.push({ id: l.id, moduleId: activeModule.id, order: idx })
          })
        
        // Update target module (add lesson to end)
        const targetLessons = [...targetModule.lessons, { ...sourceLesson, moduleId: targetModule.id }]
        targetLessons.forEach((l: any, idx: number) => {
          allLessonOrders.push({ id: l.id, moduleId: targetModule.id, order: idx })
        })
        
        reorderMutation.mutate({ lessons: allLessonOrders })
      }
      return
    }

    // Handle lesson reordering within or between modules
    if (activeId.startsWith('lesson-') && overId.startsWith('lesson-')) {
      const activeLessonId = activeId.replace('lesson-', '')
      const overLessonId = overId.replace('lesson-', '')

      // Find which modules these lessons belong to
      let activeModule: any = null
      let overModule: any = null
      let activeLessonIndex = -1
      let overLessonIndex = -1

      for (const mod of modules) {
        const lessons = mod.lessons || []
        const activeIdx = lessons.findIndex((l: any) => l.id === activeLessonId)
        const overIdx = lessons.findIndex((l: any) => l.id === overLessonId)

        if (activeIdx !== -1) {
          activeModule = mod
          activeLessonIndex = activeIdx
        }
        if (overIdx !== -1) {
          overModule = mod
          overLessonIndex = overIdx
        }
      }

      if (activeModule && overModule) {
        // Same module: reorder within module
        if (activeModule.id === overModule.id) {
          const newLessons = arrayMove(activeModule.lessons, activeLessonIndex, overLessonIndex)
          const lessonOrders = newLessons.map((les: any, index: number) => ({
            id: les.id,
            moduleId: activeModule.id,
            order: index,
          }))
          reorderMutation.mutate({ lessons: lessonOrders })
        } else {
          // Different modules: move lesson to new module
          // Remove from source module and add to target module
          const sourceLesson = activeModule.lessons[activeLessonIndex]
          
          // Create lesson orders for both modules
          const allLessonOrders: Array<{ id: string; moduleId: string; order: number }> = []
          
          // Update source module (remove lesson)
          activeModule.lessons
            .filter((l: any) => l.id !== activeLessonId)
            .forEach((l: any, idx: number) => {
              allLessonOrders.push({ id: l.id, moduleId: activeModule.id, order: idx })
            })
          
          // Update target module (insert lesson)
          const targetLessons = [...overModule.lessons]
          targetLessons.splice(overLessonIndex, 0, { ...sourceLesson, moduleId: overModule.id })
          targetLessons.forEach((l: any, idx: number) => {
            allLessonOrders.push({ id: l.id, moduleId: overModule.id, order: idx })
          })
          
          reorderMutation.mutate({ lessons: allLessonOrders })
        }
      }
    }
  }

  const handleAddModule = () => {
    createModuleMutation.mutate()
  }

  const handleAddSection = () => {
    // If there's a current module, use it as default
    if (currentModuleIndex >= 0 && modules[currentModuleIndex]) {
      setDefaultModuleId(modules[currentModuleIndex].id)
    } else {
      setDefaultModuleId(undefined)
    }
    setIsLessonCreatorOpen(true)
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-y-auto">
            <SortableContext items={moduleIds} strategy={verticalListSortingStrategy}>
              {modules.map((module: any, moduleIdx: number) => {
                const moduleLessons = module?.lessons || []
                const moduleDragId = `module-${module.id}`
                const isOver = overId === moduleDragId && activeId !== moduleDragId && activeId?.startsWith('module-')
                return (
                  <SortableModule
                    key={module.id}
                    module={module}
                    moduleIdx={moduleIdx}
                    isOpen={moduleIdx === currentModuleIndex}
                    currentLessonId={lessonId}
                    completedLessons={completedLessons}
                    canEdit={canEdit}
                    isInlineEditing={inlineEditingModuleId === module.id}
                    isDraggingOver={isOver}
                    onLessonClick={handleLessonClick}
                    onEditLesson={(id) => setEditingLessonId(id)}
                    onEditModule={() => {
                      setInlineEditingModuleId(module.id)
                    }}
                    onDeleteModule={(id) => {
                      if (confirm('Are you sure you want to delete this section? This will also delete all lessons in this section.')) {
                        deleteModuleMutation.mutate(id)
                      }
                    }}
                    onInlineEditSave={(id, title) => {
                      updateModuleMutation.mutate({ id, title })
                    }}
                    onInlineEditCancel={() => {
                      setInlineEditingModuleId(null)
                    }}
                  />
                )
              })}
            </SortableContext>
          </div>
          <DragOverlay>
            {activeId && activeId.startsWith('module-') && (() => {
              const activeModuleId = activeId.replace('module-', '')
              const activeModule = modules.find((m: any) => m.id === activeModuleId)
              if (!activeModule) return null
              return (
                <div className="bg-background border border-primary shadow-lg rounded-lg p-4 opacity-95">
                  <p className="font-medium text-sm">{activeModule.title}</p>
                  <p className="text-xs text-muted-foreground">
                    ({(activeModule.lessons || []).length} {(activeModule.lessons || []).length === 1 ? 'lesson' : 'lessons'})
                  </p>
                </div>
              )
            })()}
          </DragOverlay>
        </DndContext>

        {/* Add Module/Section Buttons */}
        {canEdit && (
          <div className="p-4 border-t bg-background space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleAddSection}
            >
              + Module
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleAddModule}
            >
              + Section
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
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
              <span className="line-clamp-1">{course.title}</span>
            </Button>
            {currentModuleIndex >= 0 && modules[currentModuleIndex] && (
              <>
                <span>/</span>
                <span className="line-clamp-1">{modules[currentModuleIndex].title}</span>
              </>
            )}
            <span>/</span>
            <span className="font-medium text-foreground line-clamp-1">{lesson.title}</span>
          </div>

          {/* Lesson Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-muted-foreground mt-2">{lesson.description}</p>
              )}
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingLessonId(lesson.id)}
                className="shrink-0"
                title="Edit lesson"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
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
          {lesson.content && (
            <div className="prose dark:prose-invert max-w-none text-muted-foreground">
              <p className="text-base leading-relaxed">{lesson.content}</p>
            </div>
          )}

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

      {/* Lesson Editor Dialog */}
      {editingLessonId && (
        <LessonEditorDialog
          lessonId={editingLessonId}
          isOpen={!!editingLessonId}
          onClose={() => setEditingLessonId(null)}
          onSave={() => {
            setEditingLessonId(null)
            queryClient.invalidateQueries({ queryKey: ['lesson', editingLessonId] })
            queryClient.invalidateQueries({ queryKey: ['course', courseId] })
          }}
          onDelete={(id) => {
            if (confirm('Are you sure you want to delete this lesson?')) {
              deleteLessonMutation.mutate(id, {
                onSuccess: () => {
                  setEditingLessonId(null)
                }
              })
            }
          }}
        />
      )}

      {/* Module Editor Dialog */}
      {isModuleEditorOpen && (
        <ModuleEditor
          module={editingModuleId ? modules.find((m: any) => m.id === editingModuleId) : null}
          courseId={courseId}
          existingModules={modules}
          isOpen={isModuleEditorOpen}
          onClose={() => {
            setIsModuleEditorOpen(false)
            setEditingModuleId(null)
          }}
          onSave={() => {
            setIsModuleEditorOpen(false)
            setEditingModuleId(null)
            queryClient.invalidateQueries({ queryKey: ['course', courseId] })
          }}
        />
      )}

      {/* Lesson Creator Dialog */}
      {isLessonCreatorOpen && (
        <LessonCreator
          courseId={courseId}
          modules={modules.map((m: any) => ({ id: m.id, title: m.title }))}
          defaultModuleId={defaultModuleId}
          existingLessons={modules.flatMap((m: any) => 
            (m.lessons || []).map((l: any) => ({ moduleId: m.id, order: l.order ?? 0 }))
          )}
          isOpen={isLessonCreatorOpen}
          onClose={() => {
            setIsLessonCreatorOpen(false)
            setDefaultModuleId(undefined)
          }}
          onSave={() => {
            setIsLessonCreatorOpen(false)
            setDefaultModuleId(undefined)
            queryClient.invalidateQueries({ queryKey: ['course', courseId] })
          }}
        />
      )}
    </div>
  )
}

// Sortable Module Component
function SortableModule({
  module,
  moduleIdx,
  isOpen,
  currentLessonId,
  completedLessons,
  canEdit,
  isInlineEditing,
  isDraggingOver,
  onLessonClick,
  onEditLesson,
  onEditModule,
  onDeleteModule,
  onInlineEditSave,
  onInlineEditCancel,
}: {
  module: any
  moduleIdx: number
  isOpen: boolean
  currentLessonId: string
  completedLessons: string[]
  canEdit: boolean
  isInlineEditing?: boolean
  isDraggingOver?: boolean
  onLessonClick: (id: string) => void
  onEditLesson: (id: string) => void
  onEditModule: () => void
  onDeleteModule?: (id: string) => void
  onInlineEditSave?: (id: string, title: string) => void
  onInlineEditCancel?: () => void
}) {
  const [editingTitle, setEditingTitle] = useState(module.title)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `module-${module.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const moduleLessons = module?.lessons || []
  const lessonIds = moduleLessons.map((l: any) => `lesson-${l.id}`)

  // Sync editing title when module title changes externally or when entering edit mode
  useEffect(() => {
    if (isInlineEditing) {
      setEditingTitle(module.title)
    }
  }, [isInlineEditing, module.title])

  const handleSave = () => {
    if (editingTitle.trim() && onInlineEditSave) {
      onInlineEditSave(module.id, editingTitle.trim())
    } else if (onInlineEditCancel) {
      onInlineEditCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditingTitle(module.title)
      onInlineEditCancel?.()
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible defaultOpen={isOpen}>
        <div className={`flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors group ${
          isDraggingOver ? 'bg-primary/20 border-2 border-primary border-dashed rounded-lg' : ''
        }`}>
          {isInlineEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm font-medium"
                  autoFocus
                  placeholder="Section name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ({moduleLessons.length} {moduleLessons.length === 1 ? 'lesson' : 'lessons'})
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleSave}
                disabled={!editingTitle.trim()}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setEditingTitle(module.title)
                  onInlineEditCancel?.()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                {canEdit && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing touch-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">{moduleIdx + 1}. {module.title}</p>
                  <p className="text-xs text-muted-foreground">
                    ({moduleLessons.length} {moduleLessons.length === 1 ? 'lesson' : 'lessons'})
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90 ml-auto" />
              </CollapsibleTrigger>
              {canEdit && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditModule()
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {onDeleteModule && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onDeleteModule) {
                          onDeleteModule(module.id)
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <CollapsibleContent>
          {moduleLessons.length > 0 && (
            <SortableContext items={lessonIds} strategy={verticalListSortingStrategy}>
              <div>
                {moduleLessons.map((lessonItem: any) => (
                  <SortableLesson
                    key={lessonItem.id}
                    lesson={lessonItem}
                    isActive={lessonItem.id === currentLessonId}
                    isCompleted={completedLessons.includes(lessonItem.id)}
                    canEdit={canEdit}
                    onLessonClick={onLessonClick}
                    onEditLesson={onEditLesson}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// Sortable Lesson Component
function SortableLesson({
  lesson,
  isActive,
  isCompleted,
  canEdit,
  onLessonClick,
  onEditLesson,
}: {
  lesson: any
  isActive: boolean
  isCompleted: boolean
  canEdit: boolean
  onLessonClick: (id: string) => void
  onEditLesson: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `lesson-${lesson.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-4 py-3 pl-8 hover:bg-muted/50 transition-colors border-l-2 ${
        isActive ? 'bg-primary/10 border-primary' : 'border-transparent'
      }`}
    >
      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none -ml-2"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      <button
        onClick={() => onLessonClick(lesson.id)}
        className="flex-1 text-left"
      >
        <p className={`text-sm ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {lesson.title}
        </p>
        {isCompleted && (
          <p className="text-xs text-green-600 mt-1">✓ Completed</p>
        )}
      </button>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onEditLesson(lesson.id)
          }}
        >
          <Edit className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

// Component to fetch and display lesson editor
function LessonEditorDialog({ 
  lessonId, 
  isOpen, 
  onClose, 
  onSave,
  onDelete
}: { 
  lessonId: string
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  onDelete?: (id: string) => void
}) {
  const { data: lessonData } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/courses/lessons/${lessonId}`)
      if (!res.ok) throw new Error('Failed to fetch lesson')
      return res.json()
    },
    enabled: isOpen && !!lessonId,
  })

  if (!lessonData) {
    return null
  }

  return (
    <LessonEditor
      lesson={lessonData}
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  )
}
