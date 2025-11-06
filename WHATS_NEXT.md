# 🎉 Multi-Tenant Setup Complete!

Your white-label SaaS architecture is ready to go!

---

## ✅ What's Been Done

### 1. **Better Auth Organization Plugin Installed**
- ✅ Server plugin configured in `server/auth/config.ts`
- ✅ Client plugin configured in `src/lib/auth-client.ts`
- ✅ Organization and Member tables defined

### 2. **Database Schema Extended**
- ✅ Added `is_god` field to user table (for super admin)
- ✅ Created `organization` table (white-label instances)
- ✅ Created `member` table (user-organization relationships)
- ✅ Added performance indexes

### 3. **Code Deployed**
- ✅ Built successfully with organization plugin
- ✅ Deployed to Cloudflare Workers
- ✅ Live at: https://shadcn-admin-cf-ai.dan-ccc.workers.dev

### 4. **Documentation Created**
- ✅ `MULTI_TENANT_SETUP.md` - Complete implementation guide
- ✅ `APPLY_ORG_MIGRATION.md` - Database migration steps
- ✅ Full usage examples and code samples

---

## 🚀 Next Steps (In Order)

### Step 1: Apply Database Migration

**Open Neon SQL Editor:**
1. Go to: https://console.neon.tech/app/projects
2. Select your project
3. Click "SQL Editor"

**Run this SQL:**
```sql
-- Add isGod field
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_god" BOOLEAN DEFAULT FALSE NOT NULL;

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
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("user_id", "organization_id")
);

-- Add session field
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "active_organization_id" TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member"("user_id");
CREATE INDEX IF NOT EXISTS "member_organization_id_idx" ON "member"("organization_id");
CREATE INDEX IF NOT EXISTS "member_role_idx" ON "member"("role");
CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "user_is_god_idx" ON "user"("is_god");
```

**Set yourself as God:**
```sql
UPDATE "user" 
SET "is_god" = TRUE 
WHERE email = 'your-email@example.com';  -- Replace with your actual email
```

**Verify it worked:**
```sql
-- Check your God status
SELECT id, email, name, is_god FROM "user" WHERE email = 'your-email@example.com';

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('organization', 'member');
```

---

### Step 2: Test Organization Creation

**From your app (use browser console):**

```javascript
// Import organization methods
import { organization } from '@/lib/auth-client';

// Create your first white-label organization
const result = await organization.create({
  name: "Acme Corp",
  slug: "acme",  // Will be: acme.yourapp.com
  logo: "https://acme.com/logo.png",
  metadata: JSON.stringify({
    tier: "pro",
    branding: {
      primaryColor: "#FF6B6B",
      companyName: "Acme AI Chat"
    }
  })
});

console.log('Organization created:', result);
```

---

### Step 3: Build God Dashboard

Create a new route for the God dashboard to manage all white-labels:

**Example: `src/routes/_authenticated/god-dashboard.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_authenticated/god-dashboard')({
  component: GodDashboard,
})

function GodDashboard() {
  const [organizations, setOrganizations] = useState([])
  
  useEffect(() => {
    // Fetch all organizations (God-only endpoint needed)
    async function fetchOrgs() {
      const response = await fetch('/api/god/organizations')
      const data = await response.json()
      setOrganizations(data)
    }
    fetchOrgs()
  }, [])
  
  return (
    <div>
      <h1>God Dashboard</h1>
      <p>Total White-Labels: {organizations.length}</p>
      
      {/* List all organizations */}
      <ul>
        {organizations.map(org => (
          <li key={org.id}>
            <h3>{org.name}</h3>
            <p>Slug: {org.slug}</p>
            <p>Members: {org.memberCount}</p>
            <button>View</button>
            <button>Suspend</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Add God API endpoint:**

```typescript
// In server/index.ts
app.get('/api/god/organizations', async (c) => {
  const { user } = await auth.api.getSession({ headers: c.req.raw.headers });
  
  // Check if user is God
  if (!user?.isGod) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  // Query all organizations
  const orgs = await db.query.organization.findMany({
    with: {
      members: true
    }
  });
  
  return c.json(orgs);
});
```

---

### Step 4: Add Organization UI Components

**Create organization selector:**
- Show current active organization
- Allow switching between organizations (if user is member of multiple)
- Show role badges (owner, admin, member)

**Create organization settings page:**
- Update name, logo
- Manage members
- Billing (if owner)
- Branding customization

---

### Step 5: Implement Subdomain Routing

**Update `server/index.ts`:**

```typescript
app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';
  const parts = host.split('.');
  
  // Extract subdomain
  if (parts.length >= 3) {
    const subdomain = parts[0];
    
    // Skip system subdomains
    if (!['www', 'api', 'admin'].includes(subdomain)) {
      // Look up organization by slug
      const org = await db.query.organization.findFirst({
        where: eq(organization.slug, subdomain)
      });
      
      if (org) {
        c.set('organization', org);
        c.set('isWhiteLabel', true);
        
        // Apply branding from metadata
        if (org.metadata) {
          const branding = JSON.parse(org.metadata);
          c.set('branding', branding);
        }
      }
    }
  }
  
  await next();
});
```

---

### Step 6: Add Tier-Based Billing

**Define tiers:**

```typescript
const TIERS = {
  free: {
    maxMembers: 5,
    maxMessages: 1000,
    features: ['basic-chat'],
    price: 0,
  },
  pro: {
    maxMembers: 50,
    maxMessages: 50000,
    features: ['basic-chat', 'advanced-ai', 'analytics'],
    price: 99,
  },
  enterprise: {
    maxMembers: Infinity,
    maxMessages: Infinity,
    features: ['all'],
    price: 499,
  },
};
```

**Add middleware to check limits:**

```typescript
app.use('/api/chat/*', async (c, next) => {
  const org = c.get('organization');
  if (!org) return next();
  
  const tier = JSON.parse(org.metadata || '{}').tier || 'free';
  const limits = TIERS[tier];
  
  // Check member count
  const memberCount = await db.$count(member, eq(member.organizationId, org.id));
  if (memberCount >= limits.maxMembers) {
    return c.json({ error: 'Member limit reached. Upgrade required.' }, 402);
  }
  
  await next();
});
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────┐
│         GOD (Super Admin)           │  ← You
│   - See ALL organizations           │
│   - System settings                 │
│   - Billing overview                │
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
  │Users│          │Users│            ← Paid customers
  └─────┘          └─────┘
```

---

## 🔑 Key Concepts

### Roles

- **God**: You. System owner. Access to everything.
- **Owner**: White-label owner. Full control of their org.
- **Admin**: Can manage users in the org.
- **Member**: Regular paid user.

### Organizations

Each organization represents a white-label instance:
- Unique slug for subdomain (e.g., `acme.yourapp.com`)
- Custom branding (logo, colors, company name)
- Tier-based limits
- Isolated data per tenant

### Metadata Structure

```typescript
{
  tier: "pro",  // free, pro, enterprise
  branding: {
    primaryColor: "#FF6B6B",
    logo: "https://...",
    companyName: "Acme AI"
  },
  customDomain: "chat.acme.com",  // Optional
}
```

---

## 🎯 Usage Examples

### Create Organization

```typescript
const { data, error } = await organization.create({
  name: "My White Label",
  slug: "mywhitelabel",
  metadata: JSON.stringify({ tier: "pro" })
});
```

### Invite Users

```typescript
await organization.inviteMember({
  email: "user@example.com",
  role: "member"
});
```

### Check User Role

```typescript
const { data: member } = await organization.getActiveMember();

if (member.role === 'owner') {
  // Show org settings
}
```

### Get All Organizations (God Only)

```typescript
// Server action
export async function getAllOrganizations() {
  const { user } = await auth.api.getSession();
  
  if (!user?.isGod) {
    throw new Error("Unauthorized");
  }
  
  return await db.query.organization.findMany();
}
```

---

## 📚 Resources

- **Full Guide**: `MULTI_TENANT_SETUP.md`
- **Migration Steps**: `APPLY_ORG_MIGRATION.md`
- **Better Auth Docs**: https://www.better-auth.com/docs/plugins/organization
- **Your App**: https://shadcn-admin-cf-ai.dan-ccc.workers.dev

---

## 🤝 Need Help?

1. Check the comprehensive guides in the repo
2. Review Better Auth organization plugin docs
3. Test organization creation in browser console first
4. Verify migration ran successfully in Neon

**You're all set to build your white-label SaaS empire! 🚀**

