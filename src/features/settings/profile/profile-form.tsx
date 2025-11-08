import { useState, useRef, useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/stores/auth-simple'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { ProfileFormValues } from './index'

type ProfileFormProps = {
  form: UseFormReturn<ProfileFormValues>
}

export function ProfileForm({ form }: ProfileFormProps) {
  const { user } = useAuth()
  const { data: session, refetch: refetchSession } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [profileImage, setProfileImage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setIsLoading(true)
      fetch('/api/user/profile', {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            form.reset({
              name: data.profile.name || '',
              bio: data.profile.bio || '',
              location: data.profile.location || '',
              jobTitle: data.profile.jobTitle || '',
              company: data.profile.company || '',
            })
            setProfileImage(data.profile.avatarUrl || data.profile.image || '')
          }
        })
        .catch(err => {
          console.error('Failed to load profile:', err)
          // Fallback to user object
          form.reset({
            name: user.name || '',
            bio: '',
            location: '',
            jobTitle: '',
            company: '',
          })
          setProfileImage(user.image || '')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [user, form])

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name && name !== 'User') {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const initials = getInitials(user?.name, user?.email)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setIsUploading(true)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const imageData = reader.result as string
        setProfileImage(imageData)

        // Save to server immediately (include all fields to avoid clearing them)
        try {
          const currentValues = form.getValues()
          const response = await fetch('/api/user/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: currentValues.name,
              image: imageData,
              bio: currentValues.bio,
              location: currentValues.location,
              jobTitle: currentValues.jobTitle,
              company: currentValues.company,
            }),
            credentials: 'include',
          })

          if (!response.ok) {
            throw new Error('Failed to update profile picture')
          }

          const result = await response.json()

          // Update local state with server response
          if (result.profile) {
            setProfileImage(result.profile.image || result.profile.avatarUrl || '')
          }

          // Refetch session to update UI components
          await refetchSession()

          toast.success('Profile picture updated')
        } catch (error) {
          console.error('Failed to save profile picture:', error)
          toast.error('Failed to save profile picture')
        }
      }
      reader.readAsDataURL(file)

      // TODO: Upload to R2 bucket for production
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  async function onSubmit(data: ProfileFormValues) {
    try {
      const response = await fetch('/api/user/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          image: profileImage,
          bio: data.bio,
          location: data.location,
          jobTitle: data.jobTitle,
          company: data.company,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const result = await response.json()

      // Update local state with server response
      if (result.profile) {
        setProfileImage(result.profile.image || result.profile.avatarUrl || '')
        form.reset({
          name: result.profile.name || '',
          bio: result.profile.bio || '',
          location: result.profile.location || '',
          jobTitle: result.profile.jobTitle || '',
          company: result.profile.company || '',
        })
      }

      // Refetch session to update UI components
      await refetchSession()

      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Failed to update profile. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Profile Picture */}
        <div className="space-y-3">
          <Label>Profile Picture</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profileImage} alt={user?.name || ''} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Change picture
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                JPG, PNG or GIF. Max size 5MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={user?.email || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-sm text-muted-foreground">
            Your email address cannot be changed.
          </p>
        </div>

        {/* Bio */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about yourself"
                  className="resize-none"
                  rows={3}
                  maxLength={500}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value?.length || 0}/500 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location, Job Title, Company */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="San Diego, CA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input placeholder="CEO" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Toolboka.ai" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Two-Factor Authentication (placeholder for future implementation) */}
        <div className="border-t pt-6">
          <h3 className="font-medium mb-2">Two-Factor Authentication (2FA)</h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account
            </p>
            <Button type="button" variant="outline" size="sm" disabled>
              Coming soon
            </Button>
          </div>
        </div>

      </form>
    </Form>
  )
}

// Export button component for use in header
export function ProfileFormSubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <Button type="submit" form="profile-form" disabled={isSubmitting}>
      {isSubmitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Saving...
        </>
      ) : (
        'Update profile'
      )}
    </Button>
  )
}
