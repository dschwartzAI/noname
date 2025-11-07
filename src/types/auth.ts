import type { UserProfile } from './user'
import type { OrganizationMetadata, OrganizationRole } from './organization'

export interface ActiveOrganization {
  id: string
  name: string
  slug: string
  role: OrganizationRole
  tierId: string | null
  metadata: OrganizationMetadata
}

export interface EnrichedSession {
  user: UserProfile
  activeOrganization: ActiveOrganization | null
}

export interface SessionUser {
  id: string
  email: string
  name: string
  image: string | null
  isGod: boolean
  emailVerified: boolean
}
