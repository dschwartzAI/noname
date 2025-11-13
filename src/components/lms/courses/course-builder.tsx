"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Plus, Upload, Loader2, X, Check } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Course {
  id: string
  title: string
  description?: string
  thumbnail?: string
  categories?: string[]
  instructorId?: string
  instructor: string
  instructorBio?: string
  instructorAvatar?: string
  tier: 'free' | 'pro'
  published: boolean
  order: number
}

interface Instructor {
  id: string
  name: string
  title?: string | null
  bio?: string | null
  avatarUrl?: string | null
}

interface CourseBuilderProps {
  course?: Course
  isOpen: boolean
  onClose: () => void
  onSave: (courseId?: string) => void
}

export function CourseBuilder({ course, isOpen, onClose, onSave }: CourseBuilderProps) {
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    description: '',
    thumbnail: '',
    categories: [],
    instructorId: undefined,
    instructor: '',
    instructorBio: '',
    instructorAvatar: '',
    tier: 'free',
    published: false,
    order: 0,
  })

  const [selectedInstructorId, setSelectedInstructorId] = useState<string | undefined>(course?.instructorId)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const thumbnailFileInputRef = useRef<HTMLInputElement | null>(null)
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const { data: instructorsData, isLoading: instructorsLoading } = useQuery<{ instructors: Instructor[] }>({
    queryKey: ['instructors'],
    queryFn: async () => {
      const res = await fetch('/api/v1/instructors')
      if (!res.ok) throw new Error('Failed to fetch instructors')
      return res.json()
    },
  })
  const instructors = instructorsData?.instructors ?? []

  // Fetch existing categories from courses
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/courses')
        if (!res.ok) throw new Error('Failed to fetch courses')
        return res.json()
      } catch (error) {
        return { courses: [] }
      }
    },
  })

  // Extract unique categories from all courses
  const existingCategories = useMemo(() => {
    const cats = new Set<string>()
    coursesData?.courses?.forEach((item: any) => {
      const categories = item.course?.categories || []
      categories.forEach((cat: string) => {
        if (cat) cats.add(cat)
      })
    })
    return Array.from(cats).sort()
  }, [coursesData])

  // Load course data when editing
  useEffect(() => {
    if (course) {
      setFormData({
        id: course.id,
        title: course.title,
        description: course.description || '',
        thumbnail: course.thumbnail || '',
        categories: course.categories || [],
        instructorId: course.instructorId,
        instructor: course.instructor,
        instructorBio: course.instructorBio || '',
        instructorAvatar: course.instructorAvatar || '',
        tier: course.tier,
        published: course.published,
        order: course.order,
      })
      setSelectedInstructorId(course.instructorId ?? undefined)
      setThumbnailPreview(course.thumbnail || null)
      setSelectedCategories(course.categories || [])
    } else {
      // Reset for new course
      setFormData({
        title: '',
        description: '',
        thumbnail: '',
        categories: [],
        instructorId: undefined,
        instructor: '',
        instructorBio: '',
        instructorAvatar: '',
        tier: 'free',
        published: false,
        order: 0,
      })
      setSelectedInstructorId(undefined)
      setThumbnailPreview(null)
      setSelectedCategories([])
      setIsAddingNewCategory(false)
      setNewCategoryName('')
    }
  }, [course, isOpen])

  // Sync thumbnail preview with formData - keep it simple and always follow formData.thumbnail
  useEffect(() => {
    setThumbnailPreview(formData.thumbnail || null)
  }, [formData.thumbnail])

  const handleThumbnailFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Course image must be less than 5MB')
      return
    }

    // Auto-upload immediately
    try {
      setThumbnailUploading(true)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const res = await fetch('/api/v1/courses/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to upload course image')
      }

      const { url } = await res.json()
      
      if (!url) {
        throw new Error('No URL returned from server')
      }
      
      const cleanUrl = url.replace(/([^:]\/)\/+/g, '$1')
      
      setFormData((prev) => ({ ...prev, thumbnail: cleanUrl }))
      
      toast.success('Course image uploaded successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload course image'
      toast.error(message)
    } finally {
      setThumbnailUploading(false)
      if (thumbnailFileInputRef.current) {
        thumbnailFileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveThumbnail = () => {
    setFormData((prev) => ({ ...prev, thumbnail: '' }))
    if (thumbnailFileInputRef.current) {
      thumbnailFileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!selectedInstructorId) {
      setFormData((prev) => ({
        ...prev,
        instructorId: undefined,
      }))
      return
    }

    const instructor = instructors.find((item) => item.id === selectedInstructorId)
    if (instructor) {
      setFormData((prev) => ({
        ...prev,
        instructorId: instructor.id,
        instructor: instructor.name,
        instructorBio: instructor.bio ?? '',
        instructorAvatar: instructor.avatarUrl ?? '',
      }))
    }
  }, [selectedInstructorId, instructors])

  const createCourseMutation = useMutation({
    mutationFn: async (data: Partial<Course>) => {
      const res = await fetch('/api/v1/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create course')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course created successfully')
      if (onSave) onSave(data.course.id)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create course')
    },
  })

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Course> }) => {
      const res = await fetch(`/api/v1/courses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update course')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course', course?.id] })
      toast.success('Course updated successfully')
      onSave()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update course')
    },
  })

  const handleSaveCourse = () => {
    const title = formData.title?.trim()
    const instructorName = formData.instructor?.trim()

    if (!title || !instructorName) {
      toast.error('Title and instructor are required')
      return
    }

    const payload: Partial<Course> = {
      title,
      description: formData.description?.trim() || undefined,
      thumbnail: formData.thumbnail?.trim() || undefined,
      categories: selectedCategories,
      instructorId: selectedInstructorId,
      instructor: instructorName,
      instructorBio: formData.instructorBio?.trim() || undefined,
      instructorAvatar: formData.instructorAvatar?.trim() || undefined,
      tier: formData.tier ?? 'free',
      published: formData.published ?? false,
      order: formData.order ?? 0,
    }

    if (course?.id) {
      updateCourseMutation.mutate({ id: course.id, data: payload })
    } else {
      createCourseMutation.mutate(payload)
    }
  }

  const isLoading = createCourseMutation.isPending || updateCourseMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Create New Course'}</DialogTitle>
          <DialogDescription>
            {course ? 'Update course details' : 'Create a new course'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Course Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Marketing Mastery"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructor">Instructor *</Label>
              <Input
                id="instructor"
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                placeholder="James Kemp"
                disabled={isLoading}
              />

              <div className="flex items-center gap-2 mt-2">
                <Select
                  value={selectedInstructorId}
                  onValueChange={(value) => setSelectedInstructorId(value)}
                  disabled={isLoading || instructorsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={instructorsLoading ? 'Loading instructors...' : 'Select existing instructor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        No instructors yet
                      </SelectItem>
                    ) : (
                      instructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                          {instructor.title ? ` — ${instructor.title}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedInstructorId(undefined)}
                  disabled={!selectedInstructorId || isLoading}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedInstructorId
                  ? 'Instructor details will auto-fill from the selected profile.'
                  : 'Select an instructor to auto-fill their information or enter custom details.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Master the art of digital marketing..."
                rows={3}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Categories (optional)</Label>
              
              {/* Selected Categories */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="gap-1">
                      {cat}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => {
                          setSelectedCategories(selectedCategories.filter((c) => c !== cat))
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add New Category Input */}
              {isAddingNewCategory ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter new category name..."
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (newCategoryName.trim() && !selectedCategories.includes(newCategoryName.trim())) {
                          setSelectedCategories([...selectedCategories, newCategoryName.trim()])
                          setIsAddingNewCategory(false)
                          setNewCategoryName('')
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingNewCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newCategoryName.trim() && !selectedCategories.includes(newCategoryName.trim())) {
                        setSelectedCategories([...selectedCategories, newCategoryName.trim()])
                        setIsAddingNewCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                    disabled={!newCategoryName.trim() || isLoading}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNewCategory(false)
                      setNewCategoryName('')
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Category Dropdown */}
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value === '__add_new__') {
                        setIsAddingNewCategory(true)
                      } else if (value && !selectedCategories.includes(value)) {
                        setSelectedCategories([...selectedCategories, value])
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add categories..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.filter((cat) => !selectedCategories.includes(cat)).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__add_new__" className="text-primary font-medium">
                        <Plus className="mr-2 h-4 w-4 inline" />
                        Create New Category
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Course Image</Label>
              <div className="flex items-start gap-4">
                <div className="h-32 w-48 rounded-lg border border-dashed flex items-center justify-center overflow-hidden bg-muted relative">
                  {thumbnailPreview ? (
                    <>
                      <img 
                        src={thumbnailPreview} 
                        alt="Course thumbnail" 
                        className="h-full w-full object-cover"
                      />
                      {thumbnailUploading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                          <div className="text-xs text-muted-foreground">Uploading...</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground text-center px-2">No image</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={thumbnailFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleThumbnailFileChange}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => thumbnailFileInputRef.current?.click()}
                      disabled={isLoading || thumbnailUploading}
                    >
                      {thumbnailUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {thumbnailPreview ? 'Change Image' : 'Upload Image'}
                        </>
                      )}
                    </Button>
                    {thumbnailPreview && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveThumbnail}
                        disabled={isLoading || thumbnailUploading}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: 16:9 aspect ratio, max 5MB. PNG, JPG, or SVG.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value: 'free' | 'pro') => setFormData({ ...formData, tier: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label htmlFor="published">Published</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveCourse} disabled={isLoading}>
            {isLoading ? 'Saving...' : course ? 'Update Course' : 'Create Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
