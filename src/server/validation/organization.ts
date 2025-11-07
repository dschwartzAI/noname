import { z } from 'zod'

export const brandingSchema = z.object({
  companyName: z.string().min(1).max(100),
  logo: z.string().url().nullable(),
  favicon: z.string().url().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  customDomain: z.string().nullable(),
  emailSenderName: z.string().min(1).max(50),
})

export const tierFeaturesSchema = z.object({
  allowedModels: z.array(z.string()),
  communityChatEnabled: z.boolean(),
  lmsCourses: z.array(z.string()),
  maxAgents: z.number().min(0),
  maxStorageGB: z.number().min(0),
  monthlyTokenLimit: z.number().nullable(),
})

export const tierSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  price: z.number().min(0),
  features: tierFeaturesSchema,
})

export const updateBrandingSchema = z.object({
  branding: brandingSchema,
})

export const updateTiersSchema = z.object({
  tiers: z.array(tierSchema),
})

export const assignTierSchema = z.object({
  tierId: z.string().nullable(),
})

export type BrandingInput = z.infer<typeof brandingSchema>
export type TierInput = z.infer<typeof tierSchema>
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>
export type UpdateTiersInput = z.infer<typeof updateTiersSchema>
export type AssignTierInput = z.infer<typeof assignTierSchema>
