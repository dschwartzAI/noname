export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  emailNotifications?: boolean
  pushNotifications?: boolean
  language?: string
  accentColor?: string
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  image: string | null // Keep for Better Auth compatibility
  bio: string | null
  phone: string | null
  timezone: string | null
  location: string | null
  jobTitle: string | null
  company: string | null
  preferences: UserPreferences
  isGod: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateUserProfileInput {
  name?: string
  bio?: string
  phone?: string
  timezone?: string
  location?: string
  jobTitle?: string
  company?: string
}

export interface UpdateUserPreferencesInput {
  theme?: 'light' | 'dark' | 'system'
  emailNotifications?: boolean
  pushNotifications?: boolean
  language?: string
  accentColor?: string
}
