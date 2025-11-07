import { eq } from 'drizzle-orm'
import * as schema from '../../../database/better-auth-schema'
import type { DbInstance } from './connection'
import type { UserProfile, UserPreferences, UpdateUserProfileInput } from '../../types/user'

/**
 * Get user profile by ID
 */
export async function getUserProfile(db: DbInstance, userId: string): Promise<UserProfile | null> {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url || null,
    image: user.image || null,
    bio: user.bio || null,
    phone: user.phone || null,
    timezone: user.timezone || null,
    location: user.location || null,
    jobTitle: user.job_title || null,
    company: user.company || null,
    preferences: (user.preferences as UserPreferences) || {},
    isGod: user.isGod || false,
    emailVerified: user.emailVerified || false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * Update user profile fields
 */
export async function updateUserProfile(
  db: DbInstance,
  userId: string,
  data: UpdateUserProfileInput & { avatarUrl?: string }
): Promise<void> {
  const updateData: any = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.timezone !== undefined) updateData.timezone = data.timezone
  if (data.location !== undefined) updateData.location = data.location
  if (data.jobTitle !== undefined) updateData.job_title = data.jobTitle
  if (data.company !== undefined) updateData.company = data.company
  if (data.avatarUrl !== undefined) {
    updateData.avatar_url = data.avatarUrl
    // Also update 'image' field for Better Auth compatibility
    // This ensures the profile picture shows in session.user.image
    updateData.image = data.avatarUrl
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(schema.user)
      .set(updateData)
      .where(eq(schema.user.id, userId))
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  db: DbInstance,
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<void> {
  // Get existing preferences
  const [user] = await db
    .select({ preferences: schema.user.preferences })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  const existing = (user?.preferences as UserPreferences) || {}
  const updated = { ...existing, ...prefs }

  await db
    .update(schema.user)
    .set({ preferences: updated })
    .where(eq(schema.user.id, userId))
}
