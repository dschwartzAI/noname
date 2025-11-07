import { useState, useRef, useEffect } from 'react'
import { Loader2, User, Plug, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/stores/auth-simple'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type SettingsTab = 'account' | 'integrations' | 'assets'

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useAuth()
  const { data: session, refetch: refetchSession } = useSession()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [profileImage, setProfileImage] = useState('')

  // Load user data when dialog opens
  useEffect(() => {
    if (open && user) {
      // Fetch full profile from API
      fetch('/api/user/profile', {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setDisplayName(data.profile.name || '')
            setProfileImage(data.profile.avatarUrl || data.profile.image || '')
            setBio(data.profile.bio || '')
            setLocation(data.profile.location || '')
            setJobTitle(data.profile.jobTitle || '')
            setCompany(data.profile.company || '')
          }
        })
        .catch(err => {
          console.error('Failed to load profile:', err)
          // Fallback to user object
          setDisplayName(user.name || '')
          setProfileImage(user.image || '')
        })
    }
  }, [open, user])

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
          const response = await fetch('/api/user/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: displayName,
              image: imageData,
              bio: bio,
              location: location,
              jobTitle: jobTitle,
              company: company,
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

  const handleSaveProfile = async () => {
    setIsSaving(true)

    try {
      // Update user profile with all fields
      const response = await fetch('/api/user/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: displayName,
          image: profileImage,
          bio: bio,
          location: location,
          jobTitle: jobTitle,
          company: company,
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
        setDisplayName(result.profile.name || '')
        setBio(result.profile.bio || '')
        setLocation(result.profile.location || '')
        setJobTitle(result.profile.jobTitle || '')
        setCompany(result.profile.company || '')
      }

      // Refetch session to update UI components
      await refetchSession()

      toast.success('Profile updated successfully')

      // Close dialog after successful save
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'integrations' as const, label: 'Integrations', icon: Plug },
    { id: 'assets' as const, label: 'Assets', icon: FolderOpen },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0" hideCloseButton>
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex" style={{ height: '600px' }}>
          {/* Sidebar */}
          <div className="w-48 border-r p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                      activeTab === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'account' && (
              <div className="space-y-6 max-w-2xl">
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

                {/* Profile Information */}
                <div>
                  <h3 className="font-medium mb-3">Profile Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-sm">Name</Label>
                        <Input
                          id="name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-sm">Email</Label>
                        <Input
                          id="email"
                          value={user?.email || ''}
                          disabled
                          className="mt-1.5 bg-muted"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="bio" className="text-sm">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 500))}
                        placeholder="Tell us about yourself"
                        rows={3}
                        className="mt-1.5 resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {bio.length}/500 characters
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="location" className="text-sm">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="San Diego, CA"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="job-title" className="text-sm">Job Title</Label>
                    <Input
                      id="job-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="CEO"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company" className="text-sm">Company</Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Toolboka.ai"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div>
                  <h3 className="font-medium mb-2">Two-Factor Authentication (2FA)</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                    <Button
                      variant={twoFactorEnabled ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    >
                      {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </Button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div>
                <h3 className="font-medium mb-2">Integrations</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Connect third-party services to enhance your experience
                </p>
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No integrations configured yet
                </div>
              </div>
            )}

            {activeTab === 'assets' && (
              <div>
                <h3 className="font-medium mb-2">Assets</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Manage your uploaded files and media
                </p>
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No assets uploaded yet
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
