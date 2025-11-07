# Phase 0: UI-Database Integration Lessons Learned

## Overview
This document captures the patterns, gotchas, and best practices discovered while building the Phase 0 data foundation and connecting it to the UI.

---

## 🎯 The Problem We Solved

**Issue**: Settings dialog persisted data, but profile picture didn't show in the nav-user component (bottom-left profile selector).

**Root Cause**:
- We were saving profile pictures to `avatar_url` (our extended field)
- Better Auth session only returns standard fields (`name`, `email`, `image`)
- UI components were checking `user.image` from the session
- Result: Profile picture saved to database but not visible in UI

---

## ✅ The Solution: Dual-Field Strategy

### 1. Save to BOTH Fields

```typescript
// In src/server/db/user-queries.ts
if (data.avatarUrl !== undefined) {
  updateData.avatar_url = data.avatarUrl  // Our extended field
  updateData.image = data.avatarUrl        // Better Auth's field
}
```

**Why This Works:**
- `avatar_url` - Our extended profile system (can query with full profile)
- `image` - Better Auth's session field (automatically included in session.user)
- Saving to both ensures compatibility with Better Auth AND our extended system

### 2. Check ALL Possible Fields in UI

```typescript
// In NavUser component
const displayAvatar = user?.image || user?.avatarUrl || user?.avatar || ''
```

**Why This Works:**
- Graceful degradation - checks multiple sources
- Works with Better Auth session (`user.image`)
- Works with extended profile API (`user.avatarUrl`)
- Backwards compatible with old field names

---

## 📚 Key Patterns for UI-Database Integration

### Pattern 1: **Hybrid Field Strategy**

When working with authentication libraries (Better Auth, NextAuth, etc.):

1. **Identify Standard Fields** - Fields the auth library natively supports
   - Better Auth: `name`, `email`, `image`, `emailVerified`

2. **Add Extended Fields** - Your custom profile fields
   - Your app: `avatar_url`, `bio`, `phone`, `location`, `job_title`, `company`

3. **Dual Save Strategy** - Save to BOTH when possible
   ```typescript
   // Always update BOTH the standard field AND your extended field
   updateData.image = imageData      // For auth library session
   updateData.avatar_url = imageData // For your extended profile
   ```

4. **Multi-Source Reads** - UI components check all sources
   ```typescript
   // Check standard field first, then extended fields
   const avatar = user?.image || user?.avatar_url || ''
   ```

---

### Pattern 2: **Explicit Data Loading**

**Problem**: UI components relying on incomplete session data

**Solution**: Load full profile explicitly when needed

```typescript
// Settings dialog useEffect
useEffect(() => {
  if (open && user) {
    // Don't rely on session alone - fetch full profile
    fetch('/api/auth/profile', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        // Now we have ALL fields, not just session fields
        setDisplayName(data.profile.name)
        setBio(data.profile.bio)
        setLocation(data.profile.location)
        // ... etc
      })
  }
}, [open, user])
```

**When to Use:**
- Forms that edit user data
- Profile pages with detailed information
- Any UI that needs extended fields beyond what's in the session

---

### Pattern 3: **Centralized Database Helpers**

**Problem**: Duplicate database logic across routes

**Solution**: Centralize queries in `/src/server/db/`

```typescript
// src/server/db/user-queries.ts
export async function getUserProfile(db, userId) {
  // Single source of truth for user profile queries
}

export async function updateUserProfile(db, userId, data) {
  // Single source of truth for profile updates
  // Handles field mapping (camelCase ↔ snake_case)
  // Ensures dual-field saves (image + avatar_url)
}
```

**Benefits:**
- DRY (Don't Repeat Yourself)
- Easy to update logic in one place
- Type-safe across all routes
- Handles field name conversions consistently

---

### Pattern 4: **Field Name Mapping**

**Problem**: API uses camelCase, database uses snake_case

**Solution**: Map in database helper layer

```typescript
// Database helper (user-queries.ts)
export async function updateUserProfile(db, userId, data) {
  const updateData: any = {}

  // API uses camelCase
  if (data.jobTitle !== undefined) updateData.job_title = data.jobTitle  // DB uses snake_case
  if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl

  await db.update(schema.user).set(updateData).where(eq(schema.user.id, userId))
}
```

**Why:**
- Keeps API clean (JavaScript/TypeScript conventions)
- Keeps database clean (SQL conventions)
- Mapping happens in ONE place (database helpers)

---

### Pattern 5: **Session Refresh After Updates**

**Problem**: UI doesn't update after saving profile changes

**Solution**: Always refetch session after mutations

```typescript
const handleSaveProfile = async () => {
  // 1. Save to database
  const response = await fetch('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  })

  // 2. Refetch session (updates auth state everywhere)
  await refetchSession()

  // 3. UI automatically updates via reactive state
  toast.success('Profile updated')
}
```

**What Gets Updated:**
- Session context (useAuth, useSession)
- All components reading from session
- Persistent storage (cookies, localStorage)

---

## 🚨 Common Gotchas & Solutions

### Gotcha 1: "Data saves but doesn't show"

**Cause**: Component using session data, but extended fields not in session

**Fix**:
- Option A: Save to auth library's standard fields (e.g., `image` for Better Auth)
- Option B: Explicitly fetch full profile in components that need it
- Option C: Extend session to include custom fields (advanced)

---

### Gotcha 2: "Form reverts after save"

**Cause**: Not refetching session after update, OR dialog closing before data loads

**Fix**:
```typescript
await fetch('/api/profile', { method: 'PUT', body: ... })
await refetchSession()  // Wait for this!
toast.success('Saved')
onOpenChange(false)  // Then close dialog
```

---

### Gotcha 3: "Some fields save, others don't"

**Cause**:
1. Missing database columns, OR
2. Validation schema doesn't include field, OR
3. Database helper not mapping the field

**Fix Checklist**:
1. ✅ Column exists in database
2. ✅ Field in TypeScript interface
3. ✅ Field in Zod validation schema
4. ✅ Field mapped in database helper
5. ✅ Field sent from frontend

---

### Gotcha 4: "Profile picture uploads but clears other fields"

**Cause**: Only sending `image` field, not including other profile data

**Fix**:
```typescript
// When uploading avatar, include ALL profile fields
body: JSON.stringify({
  image: imageData,     // The avatar
  name: displayName,    // Keep existing data
  bio: bio,             // Keep existing data
  location: location,   // Keep existing data
  // ... include all fields
})
```

---

## 🏗️ Complete Implementation Checklist

When adding a new profile field:

### 1. Database Layer
- [ ] Add column to database: `ALTER TABLE "user" ADD COLUMN "field_name" TEXT;`
- [ ] Add field to Drizzle schema: `database/better-auth-schema.ts`
- [ ] Create/update database helper: `src/server/db/user-queries.ts`

### 2. Type System
- [ ] Add field to TypeScript interface: `src/types/user.ts`
- [ ] Add field to Zod schema: `src/server/validation/user.ts`
- [ ] Add field to API input types

### 3. API Layer
- [ ] Update GET endpoint to return field
- [ ] Update PUT/POST endpoints to accept field
- [ ] Map field in database helper (camelCase ↔ snake_case)

### 4. UI Layer
- [ ] Add form field in settings dialog
- [ ] Add state variable for field
- [ ] Load field in useEffect
- [ ] Include field in save handler
- [ ] Display field where needed

### 5. Testing
- [ ] Test: Enter data → Save → Persists to database
- [ ] Test: Close dialog → Reopen → Data still there
- [ ] Test: Refresh page → Data persists
- [ ] Test: Field displays in all relevant UI components

---

## 🎓 Application to Rest of Build

### For Organization Features

**Same patterns apply:**

```typescript
// Organization branding (metadata field)
// Save to organization.metadata JSON field
await updateOrganizationBranding(db, orgId, {
  companyName: 'Acme Corp',
  primaryColor: '#3b82f6',
  logo: '/uploads/logo.png'
})

// Components check session.activeOrganization.metadata
const { companyName, primaryColor } = session.activeOrganization.metadata.branding
```

### For Member Tier Assignment

```typescript
// Save tier to member table
await assignMemberTier(db, userId, orgId, 'pro')

// Session includes user's tier
const { tierId } = session.activeOrganization
const tier = metadata.tiers.find(t => t.id === tierId)
```

### For Any Extended Data

**The Universal Pattern:**

1. **Decide data location**
   - User-specific → `user` table
   - Org-specific → `organization` table or `metadata`
   - Membership-specific → `member` table

2. **Use dual-field strategy if auth library involved**
   - Standard field (for session)
   - Extended field (for full profile API)

3. **Centralize queries**
   - `/src/server/db/` helpers
   - Map field names
   - Handle edge cases

4. **Explicit loading in UI**
   - Don't rely on incomplete session
   - Fetch full data when needed
   - Refetch after mutations

5. **Test the full cycle**
   - Save → Close → Reopen → Refresh
   - Verify persistence at every step

---

## 📝 Summary: The Golden Rules

1. **Dual-field strategy** - Save to auth library field AND your extended field
2. **Multi-source reads** - Check all possible field locations in UI
3. **Centralized helpers** - One place for database logic
4. **Explicit loading** - Fetch full data when session isn't enough
5. **Refetch after mutations** - Keep UI in sync
6. **Test the full cycle** - Save, close, reopen, refresh

**Remember**: Better Auth (or any auth library) is the source of truth for **authentication**, but YOUR database is the source of truth for **extended profile data**. Bridge the gap with dual-field saves and explicit API calls.

---

## 🔄 Next Steps

Now that we have this pattern established:

1. **Organization branding** - Apply same pattern to org metadata
2. **Tier management** - Use for member tier assignment
3. **File uploads** - Apply to R2 storage for avatars/logos
4. **All future features** - Follow this checklist

The data foundation is solid. The patterns are proven. Now we can move fast on the rest of the build with confidence! 🚀
