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
import { Switch } from '@/components/ui/switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Module {
  id: string
  courseId: string
  title: string
  description?: string
  order: number
  published: boolean
}

interface ModuleEditorProps {
  module?: Module | null
  courseId: string
  existingModules?: Module[] // Pass existing modules to calculate order
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function ModuleEditor({ module, courseId, existingModules = [], isOpen, onClose, onSave }: ModuleEditorProps) {
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Partial<Module>>({
    title: '',
    description: '',
    order: 0,
    published: false,
  })

  useEffect(() => {
    if (module) {
      setFormData({
        title: module.title,
        description: module.description || '',
        order: module.order ?? 0,
        published: module.published ?? false,
      })
    } else {
      // Calculate order for new module: max order + 1 (add to bottom)
      const maxOrder = existingModules.length > 0 
        ? Math.max(...existingModules.map(m => m.order ?? 0))
        : -1
      setFormData({
        title: '',
        description: '',
        order: maxOrder + 1,
        published: false,
      })
    }
  }, [module, isOpen, existingModules])

  const createModuleMutation = useMutation({
    mutationFn: async (data: Partial<Module>) => {
      const res = await fetch('/api/v1/courses/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: data.title,
          description: data.description || undefined,
          order: data.order || 0,
          published: data.published ?? false,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create section')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      toast.success('Section created successfully')
      onSave()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create section')
    },
  })

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Module> }) => {
      const res = await fetch(`/api/v1/courses/modules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update section')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      toast.success('Section updated successfully')
      onSave()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update section')
    },
  })

  const handleSave = () => {
    const title = formData.title?.trim()
    if (!title) {
      toast.error('Title is required')
      return
    }

    const payload: Partial<Module> = {
      title,
      description: formData.description?.trim() || undefined,
      order: formData.order ?? 0,
      published: formData.published ?? false,
    }

    if (module?.id) {
      updateModuleMutation.mutate({ id: module.id, data: payload })
    } else {
      createModuleMutation.mutate(payload)
    }
  }

  const isLoading = createModuleMutation.isPending || updateModuleMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{module ? 'Edit Section' : 'Create New Section'}</DialogTitle>
          <DialogDescription>
            {module ? 'Update section details' : 'Create a new section for this course'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="module-title">Title *</Label>
            <Input
              id="module-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Section 1: Introduction"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea
              id="module-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="This section covers the basics of..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="module-published"
              checked={formData.published}
              onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
              disabled={isLoading}
            />
            <Label htmlFor="module-published">Published</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : module ? 'Update Section' : 'Create Section'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

