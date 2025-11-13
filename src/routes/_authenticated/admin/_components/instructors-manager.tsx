"use client"

import { useState, useMemo, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, Loader2, Trash2 } from 'lucide-react'

interface Instructor {
  id: string
  name: string
  title?: string | null
  bio?: string | null
  avatarUrl?: string | null
  createdAt: string
  updatedAt: string
}

interface InstructorsResponse {
  instructors: Instructor[]
}

const initialFormState = {
  id: undefined as string | undefined,
  name: '',
  title: '',
  bio: '',
  avatarUrl: undefined as string | undefined,
}

type FormState = typeof initialFormState

export function InstructorsManager() {
  const queryClient = useQueryClient()
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setAvatarPreview(formState.avatarUrl ?? null)
  }, [formState.avatarUrl])

  const { data, isLoading } = useQuery<InstructorsResponse>({
    queryKey: ['instructors'],
    queryFn: async () => {
      const res = await fetch('/api/v1/instructors')
      if (!res.ok) throw new Error('Failed to fetch instructors')
      return res.json()
    },
  })

  const instructors = useMemo(() => data?.instructors ?? [], [data])
  const isEditing = Boolean(formState.id)

  const resetForm = () => {
    setFormState(initialFormState)
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be less than 5MB')
      return
    }

    // Auto-upload immediately
    try {
      setAvatarUploading(true)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const res = await fetch('/api/v1/instructors/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to upload avatar')
      }

      const { url } = await res.json()
      
      if (!url) {
        throw new Error('No URL returned from server')
      }
      
      const cleanUrl = url.replace(/([^:]\/)\/+/g, '$1')
      
      setFormState((prev) => ({ ...prev, avatarUrl: cleanUrl }))
      
      toast.success('Avatar uploaded successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload avatar'
      toast.error(message)
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = () => {
    setFormState((prev) => ({ ...prev, avatarUrl: undefined }))
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<FormState, 'id'>) => {
      const res = await fetch('/api/v1/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to create instructor')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Instructor created')
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Omit<FormState, 'id'> }) => {
      const res = await fetch(`/api/v1/instructors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to update instructor')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Instructor updated')
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/instructors/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to delete instructor')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Instructor deleted')
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      if (formState.id) {
        resetForm()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast.error('Name is required')
      return
    }

    const payload = {
      name: formState.name.trim(),
      title: formState.title.trim() || undefined,
      bio: formState.bio.trim() || undefined,
      avatarUrl: formState.avatarUrl || undefined,
    }

    if (isEditing && formState.id) {
      updateMutation.mutate({ id: formState.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleEdit = (instructor: Instructor) => {
    setFormState({
      id: instructor.id,
      name: instructor.name ?? '',
      title: instructor.title ?? '',
      bio: instructor.bio ?? '',
      avatarUrl: instructor.avatarUrl ?? undefined,
    })
    setAvatarPreview(instructor.avatarUrl ?? null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{isEditing ? 'Edit Instructor' : 'Add Instructor'}</h3>
          <p className="text-sm text-muted-foreground">
            Manage the instructors available in the course builder.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="instructor-name">
              Name
            </label>
            <Input
              id="instructor-name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="James Kemp"
              disabled={createMutation.isPending || updateMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="instructor-title">
              Title (optional)
            </label>
            <Input
              id="instructor-title"
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Marketing Expert"
              disabled={createMutation.isPending || updateMutation.isPending}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="instructor-bio">
              Bio (optional)
            </label>
            <Textarea
              id="instructor-bio"
              value={formState.bio}
              onChange={(event) => setFormState((prev) => ({ ...prev, bio: event.target.value }))}
              placeholder="Tell students why this instructor is qualified."
              rows={3}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="instructor-avatar">
              Avatar (optional)
            </label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-lg border border-dashed flex items-center justify-center overflow-hidden bg-muted relative">
                {avatarPreview ? (
                  <>
                    <img 
                      src={avatarPreview} 
                      alt={formState.name || 'Instructor avatar'} 
                      className="h-full w-full object-cover"
                    />
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <div className="text-xs text-muted-foreground">Uploading...</div>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground text-center px-2">No avatar</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={createMutation.isPending || updateMutation.isPending || avatarUploading}
                  >
                    {avatarUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
                      </>
                    )}
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveAvatar}
                      disabled={createMutation.isPending || updateMutation.isPending || avatarUploading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Square image, max 5MB. PNG, JPG, or SVG recommended.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEditing
                ? 'Update Instructor'
                : 'Add Instructor'}
          </Button>

          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel Edit
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Existing Instructors</h3>
          <p className="text-sm text-muted-foreground">
            Courses can reference any instructor in this list.
          </p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading instructors...</div>
        ) : instructors.length === 0 ? (
          <div className="text-sm text-muted-foreground">No instructors yet. Add your first instructor above.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Bio</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map((instructor) => (
                <TableRow key={instructor.id}>
                  <TableCell className="font-medium">{instructor.name}</TableCell>
                  <TableCell>{instructor.title || '—'}</TableCell>
                  <TableCell className="max-w-[320px] truncate">
                    {instructor.bio || '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(instructor)}
                      disabled={deleteMutation.isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(instructor.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
