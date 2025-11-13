"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Lesson {
  id: string
  moduleId: string
  title: string
  description?: string
  order: number
  published: boolean
}

interface Module {
  id: string
  title: string
}

interface LessonCreatorProps {
  courseId: string
  modules: Module[]
  defaultModuleId?: string
  existingLessons?: Array<{ moduleId: string; order: number }> // Pass existing lessons to calculate order
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function LessonCreator({ 
  courseId, 
  modules, 
  defaultModuleId,
  existingLessons = [],
  isOpen, 
  onClose, 
  onSave 
}: LessonCreatorProps) {
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Partial<Lesson>>({
    moduleId: defaultModuleId || '',
    title: '',
    description: '',
    order: 0,
    published: false,
  })

  useEffect(() => {
    if (isOpen) {
      const selectedModuleId = defaultModuleId || modules[0]?.id || ''
      
      // Calculate order for new lesson: max order + 1 for lessons in the selected module (add to bottom)
      const lessonsInModule = existingLessons.filter(l => l.moduleId === selectedModuleId)
      const maxOrder = lessonsInModule.length > 0
        ? Math.max(...lessonsInModule.map(l => l.order ?? 0))
        : -1
      
      setFormData({
        moduleId: selectedModuleId,
        title: '',
        description: '',
        order: maxOrder + 1,
        published: false,
      })
    }
  }, [isOpen, defaultModuleId, modules, existingLessons])

  const createLessonMutation = useMutation({
    mutationFn: async (data: Partial<Lesson>) => {
      if (!data.moduleId) {
        throw new Error('Module is required')
      }
      
      const res = await fetch('/api/v1/courses/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: data.moduleId,
          title: data.title,
          description: data.description || undefined,
          order: data.order || 0,
          published: data.published ?? false,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create lesson')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      toast.success('Lesson created successfully')
      onSave()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create lesson')
    },
  })

  const handleSave = () => {
    const title = formData.title?.trim()
    if (!title) {
      toast.error('Title is required')
      return
    }

    if (!formData.moduleId) {
      toast.error('Please select a section')
      return
    }

    const payload: Partial<Lesson> = {
      moduleId: formData.moduleId,
      title,
      description: formData.description?.trim() || undefined,
      order: formData.order ?? 0,
      published: formData.published ?? false,
    }

    createLessonMutation.mutate(payload)
  }

  const isLoading = createLessonMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Lesson</DialogTitle>
          <DialogDescription>
            Create a new lesson (section) for this course
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-module">Section *</Label>
            <Select
              value={formData.moduleId}
              onValueChange={(value) => {
                // Recalculate order when module changes
                const lessonsInModule = existingLessons.filter(l => l.moduleId === value)
                const maxOrder = lessonsInModule.length > 0
                  ? Math.max(...lessonsInModule.map(l => l.order ?? 0))
                  : -1
                setFormData({ ...formData, moduleId: value, order: maxOrder + 1 })
              }}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {modules.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    No sections available. Create a section first.
                  </SelectItem>
                ) : (
                  modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title *</Label>
            <Input
              id="lesson-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Lesson 1: Introduction"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="This lesson covers..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="lesson-published"
              checked={formData.published}
              onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
              disabled={isLoading}
            />
            <Label htmlFor="lesson-published">Published</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !formData.moduleId}>
            {isLoading ? 'Creating...' : 'Create Lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

