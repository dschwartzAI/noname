import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
})

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  language: z.string().optional(),
})

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().url().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>
