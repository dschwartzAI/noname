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
import { Plus, Trash2, X } from 'lucide-react'

interface Lesson {
  id: string
  moduleId: string
  title: string
  description?: string
  content?: string
  videoUrl?: string
  videoProvider?: 'youtube' | 'vimeo' | 'cloudflare' | 'custom'
  duration?: number
  thumbnail?: string
  transcript?: string
  transcriptUrl?: string
  resources?: Array<{
    id: string
    name: string
    url: string
    type: 'pdf' | 'document' | 'link' | 'file'
  }>
  published: boolean
  order: number
}

interface LessonEditorProps {
  lesson: Lesson | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function LessonEditor({ lesson, isOpen, onClose, onSave }: LessonEditorProps) {
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '',
    description: '',
    content: '',
    videoUrl: '',
    videoProvider: undefined,
    duration: undefined,
    thumbnail: '',
    transcript: '',
    transcriptUrl: '',
    resources: [],
    published: false,
    order: 0,
  })

  const [newResource, setNewResource] = useState({ name: '', url: '', type: 'link' as const })
  const [showAddResource, setShowAddResource] = useState(false)

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title,
        description: lesson.description || '',
        content: lesson.content || '',
        videoUrl: lesson.videoUrl || '',
        videoProvider: lesson.videoProvider,
        duration: lesson.duration,
        thumbnail: lesson.thumbnail || '',
        transcript: lesson.transcript || '',
        transcriptUrl: lesson.transcriptUrl || '',
        resources: lesson.resources || [],
        published: lesson.published ?? false,
        order: lesson.order ?? 0,
      })
    } else {
      setFormData({
        title: '',
        description: '',
        content: '',
        videoUrl: '',
        videoProvider: undefined,
        duration: undefined,
        thumbnail: '',
        transcript: '',
        transcriptUrl: '',
        resources: [],
        published: false,
        order: 0,
      })
    }
    setShowAddResource(false)
    setNewResource({ name: '', url: '', type: 'link' })
  }, [lesson, isOpen])

  const updateLessonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lesson> }) => {
      const res = await fetch(`/api/v1/courses/lessons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update lesson')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', lesson?.id] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      toast.success('Lesson updated successfully')
      onSave()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update lesson')
    },
  })

  const handleAddResource = () => {
    if (!newResource.name.trim() || !newResource.url.trim()) {
      toast.error('Resource name and URL are required')
      return
    }

    const resource = {
      id: crypto.randomUUID(),
      name: newResource.name.trim(),
      url: newResource.url.trim(),
      type: newResource.type,
    }

    setFormData({
      ...formData,
      resources: [...(formData.resources || []), resource],
    })
    setNewResource({ name: '', url: '', type: 'link' })
    setShowAddResource(false)
  }

  const handleRemoveResource = (resourceId: string) => {
    setFormData({
      ...formData,
      resources: (formData.resources || []).filter((r) => r.id !== resourceId),
    })
  }

  const handleSave = () => {
    if (!lesson?.id) {
      toast.error('No lesson selected')
      return
    }

    const title = formData.title?.trim()
    if (!title) {
      toast.error('Title is required')
      return
    }

    const payload: Partial<Lesson> = {
      title,
      description: formData.description?.trim() || undefined,
      content: formData.content?.trim() || undefined,
      videoUrl: formData.videoUrl?.trim() || undefined,
      videoProvider: formData.videoProvider,
      duration: formData.duration,
      thumbnail: formData.thumbnail?.trim() || undefined,
      transcript: formData.transcript?.trim() || undefined,
      transcriptUrl: formData.transcriptUrl?.trim() || undefined,
      resources: formData.resources || [],
      published: formData.published ?? false,
      order: formData.order ?? 0,
    }

    updateLessonMutation.mutate({ id: lesson.id, data: payload })
  }

  const isLoading = updateLessonMutation.isPending

  if (!lesson) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lesson</DialogTitle>
          <DialogDescription>
            Update lesson details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title *</Label>
            <Input
              id="lesson-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Introduction to Marketing"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Learn the basics of..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-content">Content</Label>
            <Textarea
              id="lesson-content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter additional content text that appears below the video..."
              rows={6}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              This content will appear below the video player on the lesson page
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-video-url">Video URL</Label>
              <Input
                id="lesson-video-url"
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-video-provider">Video Provider</Label>
              <Select
                value={formData.videoProvider}
                onValueChange={(value: 'youtube' | 'vimeo' | 'cloudflare' | 'custom') => 
                  setFormData({ ...formData, videoProvider: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="cloudflare">Cloudflare</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-duration">Duration (seconds)</Label>
              <Input
                id="lesson-duration"
                type="number"
                value={formData.duration || ''}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || undefined })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-thumbnail">Thumbnail URL</Label>
              <Input
                id="lesson-thumbnail"
                type="url"
                value={formData.thumbnail}
                onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                placeholder="https://..."
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-transcript">Transcript</Label>
            <Textarea
              id="lesson-transcript"
              value={formData.transcript}
              onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
              placeholder="Enter transcript text..."
              rows={4}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-transcript-url">Transcript URL</Label>
            <Input
              id="lesson-transcript-url"
              type="url"
              value={formData.transcriptUrl}
              onChange={(e) => setFormData({ ...formData, transcriptUrl: e.target.value })}
              placeholder="https://..."
              disabled={isLoading}
            />
          </div>

          {/* Resources Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Resources</Label>
              {!showAddResource && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddResource(true)}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Resource
                </Button>
              )}
            </div>

            {/* Existing Resources */}
            {formData.resources && formData.resources.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3">
                {formData.resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{resource.name}</p>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary truncate block"
                      >
                        {resource.url}
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveResource(resource.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Resource Form */}
            {showAddResource && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="resource-name">Resource Name *</Label>
                  <Input
                    id="resource-name"
                    value={newResource.name}
                    onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                    placeholder="Worksheet PDF"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource-url">Resource URL *</Label>
                  <Input
                    id="resource-url"
                    type="url"
                    value={newResource.url}
                    onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                    placeholder="https://..."
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource-type">Type</Label>
                  <Select
                    value={newResource.type}
                    onValueChange={(value: 'pdf' | 'document' | 'link' | 'file') =>
                      setNewResource({ ...newResource, type: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="file">File</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddResource}
                    disabled={isLoading || !newResource.name.trim() || !newResource.url.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddResource(false)
                      setNewResource({ name: '', url: '', type: 'link' })
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {(!formData.resources || formData.resources.length === 0) && !showAddResource && (
              <p className="text-sm text-muted-foreground">No resources added yet</p>
            )}
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
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Update Lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

