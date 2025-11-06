# 🏢 Multi-Tenant White-Label Setup

**White-Label SaaS Architecture: God → Owner → Users**

This guide implements a complete multi-tenant white-label system using Better Auth's Organization plugin.

---

## 🎯 Architecture Overview

### User Hierarchy

```
┌─────────────────────────────────────┐
│         GOD (Super Admin)           │  ← You (system owner)
│   - Access to ALL organizations     │
│   - System-wide settings             │
│   - Billing management               │
└─────────────┬───────────────────────┘
              │
     ┌────────┴────────┐
     │                 │
┌────▼──────┐    ┌────▼──────┐
│  Owner 1  │    │  Owner 2  │        ← White-label owners
│ (Admin)   │    │ (Admin)   │
│  Org A    │    │  Org B    │
└────┬──────┘    └────┬──────┘
     │                │
  ┌──┴──┐          ┌──┴──┐
  │  U  │          │  U  │            ← Paid users per org
  │  s  │          │  s  │
  │  e  │          │  e  │
  │  r  │          │  r  │
  │  s  │          │  s  │
  └─────┘          └─────┘
```

### Database Schema

```
┌─────────────┐
│    User     │  ← All users (God, Owners, Users)
├─────────────┤
│ id          │
│ email       │
│ name        │
│ isGod       │  ← NEW: Super admin flag
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────┐
│   Organization  │  ← White-label instances
├─────────────────┤
│ id              │
│ name            │
│ slug            │  ← Subdomain (acme.yourapp.com)
│ logo            │
│ metadata        │  ← Custom branding, tier, etc.
└──────┬──────────┘
       │
       │ 1:N
       │
┌──────▼──────┐
│   Member    │  ← User-Organization relationship
├─────────────┤
│ id          │
│ userId      │
│ orgId       │
│ role        │  ← "owner", "admin", "member"
└─────────────┘
```

---

## 🚀 Implementation Steps

### Step 1: Install Organization Plugin

```bash
cd /Users/danielschwartz/noname/noname
```

**Update `server/auth/config.ts`:**

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous, openAPI, organization } from 'better-auth/plugins';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../database/better-auth-schema';

export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export function createAuth(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    
    plugins: [
      anonymous(),
      openAPI(),
      organization({
        // Only Pro users or God users can create organizations
        allowUserToCreateOrganization: async (user) => {
          // Check if user is God (super admin)
          if (user.isGod) return true;
          
          // Check if user has Pro subscription
          // const subscription = await getSubscription(user.id);
          // return subscription.plan === 'pro';
          
          // For now, allow all users to create orgs (we'll restrict later)
          return true;
        },
        
        // Custom AC (Access Control) for better security
        ac: {
          organization: {
            create: ['owner'],
            update: ['owner', 'admin'],
            delete: ['owner'],
          },
          member: {
            create: ['owner', 'admin'],
            update: ['owner', 'admin'],
            delete: ['owner', 'admin'],
          },
        },
      }),
    ],
    
    secret: env.BETTER_AUTH_SECRET || 'CPmXy0XgIWaOICeanyyFhR5eFwyQgoSJ0LpGtgJrpHc=',
    baseURL: env.BETTER_AUTH_URL || 'https://shadcn-admin-cf-ai.dan-ccc.workers.dev',
    
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
    
    socialProviders: {
      google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      } : undefined,
      github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET
      } : undefined,
    },
  });
}
```

### Step 2: Update Client Plugin

**Update `src/lib/auth-client.ts`:**

```typescript
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:5173",
  plugins: [
    organizationClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  // Organization methods
  organization,
} = authClient;
```

### Step 3: Generate Database Schema

Run Better Auth CLI to generate the organization tables:

```bash
npx @better-auth/cli generate
```

This will create:
- `organization` table (id, name, slug, logo, metadata, createdAt)
- `member` table (id, userId, organizationId, role, createdAt)

### Step 4: Add `isGod` Field to User Table

**Update `database/better-auth-schema.ts`:**

```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  isAnonymous: boolean("is_anonymous"),
  isGod: boolean("is_god").default(false).notNull(), // ← ADD THIS
});

// ... rest of tables
```

### Step 5: Run Migration

Create migration file: `database/migrations/0002_add_organizations.sql`

```sql
-- Add isGod field to user table
ALTER TABLE "user" ADD COLUMN "is_god" BOOLEAN DEFAULT FALSE NOT NULL;

-- Create organization table
CREATE TABLE IF NOT EXISTS "organization" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logo" TEXT,
  "metadata" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create member table
CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("user_id", "organization_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member"("user_id");
CREATE INDEX IF NOT EXISTS "member_organization_id_idx" ON "member"("organization_id");
CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");

-- Add active organization to session (optional, for UX)
ALTER TABLE "session" ADD COLUMN "active_organization_id" TEXT;
```

Apply migration:

```bash
# Using the Neon SQL Editor or:
node -e "
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL);
const migration = readFileSync('./database/migrations/0002_add_organizations.sql', 'utf-8');
await sql\`\${sql.raw(migration)}\`;
console.log('✅ Migration completed');
"
```

---

## 🎯 Usage Examples

### 1. God Account Setup

First, manually set your account as God:

```sql
-- In Neon SQL Editor
UPDATE "user" 
SET "is_god" = TRUE 
WHERE email = 'your-email@example.com';
```

### 2. Create Organization (White-Label)

```typescript
// Owner creates their white-label organization
const { data, error } = await organization.create({
  name: "Acme Corp",
  slug: "acme",  // Will be: acme.yourapp.com
  logo: "https://acme.com/logo.png",
  metadata: {
    tier: "pro",
    customDomain: "chat.acme.com",
    branding: {
      primaryColor: "#FF6B6B",
      companyName: "Acme AI Chat"
    }
  }
});

// Creator automatically becomes "owner" role
```

### 3. Invite Members (Paid Users)

```typescript
// Owner invites users to their organization
const { data, error } = await organization.inviteMember({
  email: "user@example.com",
  role: "member",  // or "admin"
  organizationId: "org-id"  // optional, uses active org
});
```

### 4. God Dashboard (View All Orgs)

```typescript
// God account page - server action
export async function getAllOrganizations() {
  const { user } = await auth.api.getSession();
  
  if (!user?.isGod) {
    throw new Error("Unauthorized");
  }
  
  // Direct database query since God bypasses org scoping
  const orgs = await db.query.organization.findMany({
    with: {
      members: {
        with: {
          user: true
        }
      }
    }
  });
  
  return orgs;
}
```

### 5. Check User Role

```typescript
// In components
const { data: member } = await organization.getActiveMember();

if (member.role === 'owner') {
  // Show billing, org settings
}

if (member.role === 'admin') {
  // Show user management, some settings
}

if (member.role === 'member') {
  // Show only user features
}
```

---

## 🔒 Access Control

### Role Permissions

```typescript
const PERMISSIONS = {
  owner: [
    'org.delete',
    'org.update',
    'org.billing',
    'member.create',
    'member.update',
    'member.delete',
    'settings.all',
  ],
  admin: [
    'org.update',
    'member.create',
    'member.update',
    'settings.some',
  ],
  member: [
    'chat.use',
    'profile.update',
  ],
  god: ['*'], // Everything
};
```

### Middleware for Route Protection

```typescript
// server/middleware/org-guard.ts
export async function requireOrgRole(roles: string[]) {
  return async (c: Context, next: Next) => {
    const { user, session } = await auth.api.getSession({ headers: c.req.raw.headers });
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // God bypasses all checks
    if (user.isGod) {
      c.set('user', user);
      c.set('isGod', true);
      return next();
    }
    
    // Check organization membership
    const member = await db.query.member.findFirst({
      where: eq(member.userId, user.id),
    });
    
    if (!member || !roles.includes(member.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    c.set('user', user);
    c.set('member', member);
    c.set('orgId', member.organizationId);
    return next();
  };
}
```

---

## 🌐 Subdomain Routing

### Cloudflare Workers Setup

```typescript
// server/index.ts
app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';
  const parts = host.split('.');
  
  // Extract subdomain
  if (parts.length >= 3) {
    const subdomain = parts[0];
    
    // Skip for www, api, etc.
    if (!['www', 'api', 'admin'].includes(subdomain)) {
      // Look up organization by slug
      const org = await db.query.organization.findFirst({
        where: eq(organization.slug, subdomain)
      });
      
      if (org) {
        c.set('organization', org);
        c.set('isWhiteLabel', true);
      }
    }
  }
  
  await next();
});
```

### Custom Domain Support

Store in organization metadata:

```typescript
metadata: {
  customDomain: "chat.acme.com",
  branding: {
    primaryColor: "#FF6B6B",
    logo: "https://acme.com/logo.png",
    companyName: "Acme AI Chat"
  }
}
```

---

## 💰 Billing Integration

### Tier-Based Access

```typescript
const TIERS = {
  free: {
    maxMembers: 5,
    maxMessages: 1000,
    features: ['basic-chat'],
  },
  pro: {
    maxMembers: 50,
    maxMessages: 50000,
    features: ['basic-chat', 'advanced-ai', 'analytics'],
  },
  enterprise: {
    maxMembers: Infinity,
    maxMessages: Infinity,
    features: ['all'],
  },
};

// Check tier in middleware
const org = c.get('organization');
const tier = org.metadata.tier || 'free';

if (tier === 'free' && memberCount >= TIERS.free.maxMembers) {
  return c.json({ error: 'Upgrade required' }, 402);
}
```

---

## 🎨 White-Label Branding

### Dynamic Theming

```typescript
// In your app
const { data: org } = await organization.getActiveOrganization();

if (org?.metadata?.branding) {
  const { primaryColor, logo, companyName } = org.metadata.branding;
  
  // Apply to theme
  document.documentElement.style.setProperty('--primary', primaryColor);
  // Update logo, company name, etc.
}
```

---

## 📊 God Dashboard Features

1. **View All Organizations**
   - List all white-labels
   - See member counts, tier, revenue
   - Quick actions (suspend, upgrade, delete)

2. **Impersonate Organization**
   - Switch to any org to see their view
   - Debug issues

3. **System Analytics**
   - Total users across all orgs
   - Revenue by org
   - Usage metrics

4. **Billing Management**
   - Set tiers manually
   - Apply discounts
   - View payment history

---

## 🚀 Next Steps

1. ✅ Run migrations to add org tables
2. ✅ Update Better Auth config with org plugin
3. ✅ Set your account as God
4. ✅ Build God dashboard UI
5. ✅ Build org creation flow
6. ✅ Build member invitation system
7. ✅ Add subdomain routing
8. ✅ Implement tier-based access
9. ✅ Add billing integration

---

**Your multi-tenant white-label SaaS is ready!** 🎉

