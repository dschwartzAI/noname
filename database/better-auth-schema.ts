import { pgTable, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  isAnonymous: boolean("is_anonymous"),
  isGod: boolean("is_god").default(false).notNull(), // Super admin flag for white-label management
  // Profile fields
  avatar_url: text("avatar_url"),
  bio: text("bio"),
  phone: text("phone"),
  timezone: text("timezone"),
  location: text("location"),
  job_title: text("job_title"),
  company: text("company"),
  preferences: jsonb("preferences").$type<{
    theme?: 'light' | 'dark' | 'system'
    emailNotifications?: boolean
    pushNotifications?: boolean
    language?: string
  }>().default({}),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"), // Current active org for the session
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Organization Plugin Tables
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  favicon: text("favicon"),
  metadata: text("metadata"), // JSON string for custom branding, tier, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "owner", "admin", "member"
  tierId: text("tier_id"), // Reference to tier in organization.metadata.tiers
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Owner Invites - God tier functionality
export const ownerInvite = pgTable("owner_invite", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  organizationPreset: text("organization_preset"), // JSON string for pre-configured org settings
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Chat Tables
export const conversation = pgTable("conversation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Auto-generated from first message or user-set
  toolId: text("tool_id"), // Reference to AI tool/agent (nullable for default chat)
  model: text("model").default("gpt-4o-mini"), // AI model used (gpt-4o, claude-3-5-sonnet, etc.)
  systemPrompt: text("system_prompt"), // Optional system prompt
  metadata: jsonb("metadata").$type<{
    agentId?: string;
    tags?: string[];
    archived?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  // Index for loading user's conversations (most recent first)
  userOrgUpdatedIdx: index("conversation_user_org_updated_idx")
    .on(table.userId, table.organizationId, table.updatedAt.desc()),
  // Index for organization-wide conversation queries
  orgUpdatedIdx: index("conversation_org_updated_idx")
    .on(table.organizationId, table.updatedAt.desc()),
}));

export const message = pgTable("message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant" | "system" | "tool"
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>>(), // For future agent/tool integration
  toolResults: jsonb("tool_results").$type<Array<{
    toolCallId: string;
    result: unknown;
  }>>(), // Tool execution results
  metadata: jsonb("metadata").$type<{
    model?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for loading messages within a conversation (chronological order)
  conversationCreatedIdx: index("message_conversation_created_idx")
    .on(table.conversationId, table.createdAt.asc()),
  // Index for organization-wide message queries (for analytics/search)
  orgCreatedIdx: index("message_org_created_idx")
    .on(table.organizationId, table.createdAt.desc()),
}));
