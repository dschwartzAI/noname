import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { getDb } from '../db/connection'
import { getUserProfile, updateUserProfile, updateUserPreferences } from '../db/user-queries'
import { updateProfileSchema, updatePreferencesSchema, updateAvatarSchema } from '../validation/user'

type Env = {
  DATABASE_URL: string
}

const userApp = new Hono<{ Bindings: Env; Variables: { user: any } }>()

// Apply auth middleware
userApp.use('*', requireAuth)

// GET /api/user/profile - Get current user profile
userApp.get('/profile', async (c) => {
  try {
    const currentUser = c.get('user')
    const db = getDb(c)

    const profile = await getUserProfile(db, currentUser.id)

    if (!profile) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({ profile })
  } catch (error) {
    console.error('Failed to get user profile:', error)
    return c.json({ error: 'Failed to get user profile' }, 500)
  }
})

// PUT /api/user/profile - Update user profile
userApp.put('/profile', zValidator('json', updateProfileSchema), async (c) => {
  try {
    const currentUser = c.get('user')
    const updates = c.req.valid('json')
    const db = getDb(c)

    await updateUserProfile(db, currentUser.id, updates)

    return c.json({ success: true, message: 'Profile updated' })
  } catch (error) {
    console.error('Failed to update user profile:', error)
    return c.json({ error: 'Failed to update user profile' }, 500)
  }
})

// PUT /api/user/avatar - Update avatar URL
userApp.put('/avatar', zValidator('json', updateAvatarSchema), async (c) => {
  try {
    const currentUser = c.get('user')
    const { avatarUrl } = c.req.valid('json')
    const db = getDb(c)

    await updateUserProfile(db, currentUser.id, { avatarUrl })

    return c.json({ success: true, message: 'Avatar updated' })
  } catch (error) {
    console.error('Failed to update avatar:', error)
    return c.json({ error: 'Failed to update avatar' }, 500)
  }
})

// PUT /api/user/preferences - Update user preferences
userApp.put('/preferences', zValidator('json', updatePreferencesSchema), async (c) => {
  try {
    const currentUser = c.get('user')
    const preferences = c.req.valid('json')
    const db = getDb(c)

    await updateUserPreferences(db, currentUser.id, preferences)

    return c.json({ success: true, message: 'Preferences updated' })
  } catch (error) {
    console.error('Failed to update preferences:', error)
    return c.json({ error: 'Failed to update preferences' }, 500)
  }
})

// Legacy endpoint for backwards compatibility
// POST /api/auth/update-user (called by settings dialog)
userApp.post('/update-user', async (c) => {
  try {
    const currentUser = c.get('user')
    const body = await c.req.json()
    const db = getDb(c)

    await updateUserProfile(db, currentUser.id, {
      name: body.name,
      avatarUrl: body.image, // Map image to avatarUrl
      bio: body.bio,
      phone: body.phone,
      timezone: body.timezone,
      location: body.location,
      jobTitle: body.jobTitle,
      company: body.company,
    })

    // Return updated profile so client can update UI
    const updatedProfile = await getUserProfile(db, currentUser.id)

    return c.json({ success: true, profile: updatedProfile })
  } catch (error) {
    console.error('Failed to update user:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

export default userApp
