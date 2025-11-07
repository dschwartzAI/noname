import { eq, and } from 'drizzle-orm'
import * as schema from '../../../database/better-auth-schema'
import type { DbInstance } from './connection'
import type {
  Organization,
  OrganizationMetadata,
  OrganizationBranding,
  OrganizationTier,
  OrganizationRole,
} from '../../types/organization'

/**
 * Get organization by ID with parsed metadata
 */
export async function getOrganizationWithMetadata(
  db: DbInstance,
  orgId: string
): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1)

  if (!org) return null

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    metadata: org.metadata ? JSON.parse(org.metadata) : getDefaultMetadata(),
    createdAt: org.createdAt.toISOString(),
  }
}

/**
 * Update organization branding
 */
export async function updateOrganizationBranding(
  db: DbInstance,
  orgId: string,
  branding: OrganizationBranding
): Promise<void> {
  // Get existing metadata
  const org = await getOrganizationWithMetadata(db, orgId)
  if (!org) throw new Error('Organization not found')

  const metadata: OrganizationMetadata = {
    ...org.metadata,
    branding,
  }

  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(schema.organization.id, orgId))
}

/**
 * Update organization tiers
 */
export async function updateOrganizationTiers(
  db: DbInstance,
  orgId: string,
  tiers: OrganizationTier[]
): Promise<void> {
  // Get existing metadata
  const org = await getOrganizationWithMetadata(db, orgId)
  if (!org) throw new Error('Organization not found')

  const metadata: OrganizationMetadata = {
    ...org.metadata,
    tiers,
  }

  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(schema.organization.id, orgId))
}

/**
 * Get user's role in organization
 */
export async function getUserRole(
  db: DbInstance,
  userId: string,
  orgId: string
): Promise<OrganizationRole | null> {
  const [membership] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, orgId)))
    .limit(1)

  return membership?.role as OrganizationRole | null
}

/**
 * Get user's tier ID in organization
 */
export async function getUserTier(
  db: DbInstance,
  userId: string,
  orgId: string
): Promise<string | null> {
  const [membership] = await db
    .select({ tierId: schema.member.tierId })
    .from(schema.member)
    .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, orgId)))
    .limit(1)

  return membership?.tierId || null
}

/**
 * Assign tier to member
 */
export async function assignMemberTier(
  db: DbInstance,
  userId: string,
  orgId: string,
  tierId: string | null
): Promise<void> {
  await db
    .update(schema.member)
    .set({ tierId })
    .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, orgId)))
}

/**
 * Check if user is owner of organization
 */
export async function isOrgOwner(
  db: DbInstance,
  userId: string,
  orgId: string
): Promise<boolean> {
  const role = await getUserRole(db, userId, orgId)
  return role === 'owner'
}

/**
 * Check if user is owner or admin of organization
 */
export async function isOrgOwnerOrAdmin(
  db: DbInstance,
  userId: string,
  orgId: string
): Promise<boolean> {
  const role = await getUserRole(db, userId, orgId)
  return role === 'owner' || role === 'admin'
}

/**
 * Update organization analytics
 */
export async function updateOrganizationAnalytics(
  db: DbInstance,
  orgId: string,
  updates: Partial<{ totalTokensUsed: number; lastActive: string }>
): Promise<void> {
  const org = await getOrganizationWithMetadata(db, orgId)
  if (!org) throw new Error('Organization not found')

  const metadata: OrganizationMetadata = {
    ...org.metadata,
    analytics: {
      ...org.metadata.analytics,
      ...updates,
    },
  }

  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(schema.organization.id, orgId))
}

/**
 * Get default metadata structure
 */
function getDefaultMetadata(): OrganizationMetadata {
  return {
    branding: {
      companyName: '',
      logo: null,
      favicon: null,
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
      customDomain: null,
      emailSenderName: '',
    },
    tiers: [],
    analytics: {
      totalTokensUsed: 0,
      lastActive: new Date().toISOString(),
    },
  }
}
