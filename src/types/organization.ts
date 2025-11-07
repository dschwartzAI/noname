export type OrganizationRole = "owner" | "admin" | "member";

export interface OrganizationBranding {
  companyName: string
  logo: string | null
  favicon: string | null
  primaryColor: string
  secondaryColor: string
  customDomain: string | null
  emailSenderName: string
}

export interface TierFeatures {
  allowedModels: string[]
  communityChatEnabled: boolean
  lmsCourses: string[]
  maxAgents: number
  maxStorageGB: number
  monthlyTokenLimit: number | null
}

export interface OrganizationTier {
  id: string
  name: string
  price: number
  features: TierFeatures
}

export interface OrganizationAnalytics {
  totalTokensUsed: number
  lastActive: string
}

export interface OrganizationMetadata {
  branding: OrganizationBranding
  tiers: OrganizationTier[]
  analytics: OrganizationAnalytics
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: OrganizationMetadata | null;
  createdAt: Date;
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  tierId: string | null;
  createdAt: Date;
}

export interface OrganizationWithStats extends Organization {
  memberCount: number;
  ownerName?: string;
  status?: "active" | "suspended" | "inactive";
}

export interface MemberWithUser extends Member {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}
