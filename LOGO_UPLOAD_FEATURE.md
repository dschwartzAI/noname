# Logo Upload Feature Implementation

## Overview

Implemented a complete logo upload feature that allows organization owners to upload custom logos through the Admin panel. The logos are stored in Cloudflare R2 and displayed in the sidebar.

## What Was Implemented

### 1. Admin Panel Settings Tab

**File**: `src/routes/_authenticated/admin/index.tsx`

- Added a new "Settings" tab to the Admin panel
- Created a Branding section within Settings
- Integrated the LogoUpload component

### 2. Logo Upload Component

**File**: `src/routes/_authenticated/admin/_components/logo-upload.tsx`

Features:
- File selection with drag-and-drop support
- Image preview before upload
- File validation (type and size)
- Progress indicator during upload
- Success/error notifications using Sonner
- Remove logo functionality
- Displays current logo from database

Validation:
- Max file size: 5MB
- Allowed types: image/* (PNG, JPG, SVG, etc.)

### 3. API Endpoints

**File**: `src/server/routes/logo.ts`

New endpoint:
```
POST /api/organization/logo/upload
```

Features:
- Requires authentication
- Verifies user is an organization owner
- Uploads file to Cloudflare R2 bucket
- Generates unique filename with timestamp
- Returns public URL for the uploaded logo

### 4. Server Configuration

**File**: `src/server/index.ts`

Updates:
- Added R2Bucket type definitions
- Added `R2_LOGOS` and `R2_PUBLIC_URL` to Env interface
- Registered logo route: `/api/organization/logo`

### 5. Sidebar Logo Display

**File**: `src/components/layout/team-switcher.tsx`

Features:
- Fetches organization data from API
- Displays custom logo if available
- Falls back to icon if no custom logo
- Properly handles image loading and scaling
- Shows organization name from database

### 6. Database Schema

**Already exists**: `database/better-auth-schema.ts`

The organization table already has a `logo` field:
```typescript
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),  // ← Used for storing logo URLs
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 7. Documentation

**Files**:
- `R2_LOGO_SETUP.md` - Comprehensive setup guide for R2 bucket configuration

## How It Works

### Upload Flow

1. **User Action**: Owner navigates to Admin > Settings tab and selects an image
2. **Frontend Validation**: File type and size validated client-side
3. **Preview**: Image preview shown to user
4. **Upload**: On click, file sent to `/api/organization/logo/upload`
5. **Server Validation**: Server validates file type, size, and ownership
6. **R2 Upload**: File uploaded to R2 with unique filename
7. **Database Update**: Organization logo field updated with public URL
8. **UI Refresh**: React Query invalidates cache, sidebar refreshes with new logo

### Display Flow

1. **TeamSwitcher** component fetches organization data via React Query
2. Checks if `organization.logo` exists
3. If yes, displays `<img>` with logo URL
4. If no, displays default icon from sidebar config

## Setup Required

### 1. Cloudflare R2 Bucket

Create a bucket named `organization-logos` (or your preferred name) in Cloudflare R2.

### 2. Public Access

Set up public access using either:
- Custom domain (recommended)
- Cloudflare Worker to serve files

### 3. Environment Variables

Add to `.env.local`:
```env
R2_PUBLIC_URL=https://logos.yourdomain.com
```

### 4. wrangler.toml

Add R2 bucket binding:
```toml
[[r2_buckets]]
binding = "R2_LOGOS"
bucket_name = "organization-logos"
```

See `R2_LOGO_SETUP.md` for detailed instructions.

## Testing

### Manual Testing Steps

1. **Upload Logo**:
   - Login as an organization owner
   - Navigate to `/admin` 
   - Click "Settings" tab
   - Click "Choose Image" and select an image
   - Click "Upload Logo"
   - Verify success notification
   - Check sidebar shows new logo

2. **Remove Logo**:
   - Click X button on logo preview
   - Verify logo removed from sidebar
   - Verify default icon appears

3. **Non-Owner Access**:
   - Login as a non-owner member
   - Navigate to `/admin`
   - Settings tab should show current logo but no upload controls (if implemented)
   - Attempt to upload via API should fail with 403

4. **Validation**:
   - Try uploading file > 5MB (should fail)
   - Try uploading non-image file (should fail)

## Security

### Access Control
- Only organization owners can upload/change logos
- Enforced at API level with role check
- Database query verifies membership and role

### File Validation
- Client-side: File type and size validation
- Server-side: File type validation with MIME type check
- Size limit: 5MB
- Filename sanitization with timestamp

### Public URLs
- Logos are publicly accessible (by design)
- No sensitive information in filenames
- URLs are predictable but not guessable

## Future Enhancements

### Priority
- [ ] Delete old logo from R2 when uploading new one
- [ ] Image optimization/compression before upload
- [ ] Support for different logo sizes (favicon, mobile, etc.)

### Nice to Have
- [ ] Crop/resize UI before upload
- [ ] Logo preview in multiple contexts
- [ ] Logo history/versioning
- [ ] Bulk upload for God mode users
- [ ] Logo usage analytics

## Files Modified

```
✓ src/routes/_authenticated/admin/index.tsx
✓ src/routes/_authenticated/admin/_components/logo-upload.tsx (new)
✓ src/server/routes/logo.ts (new)
✓ src/server/index.ts
✓ src/components/layout/team-switcher.tsx
✓ R2_LOGO_SETUP.md (new)
✓ LOGO_UPLOAD_FEATURE.md (new)
```

## Dependencies

All required dependencies already exist:
- `@tanstack/react-query` - For API calls and caching
- `sonner` - For toast notifications
- `lucide-react` - For icons
- `shadcn/ui` components

## API Reference

### Upload Logo

```typescript
POST /api/organization/logo/upload

Headers:
  Content-Type: multipart/form-data
  Cookie: session token (authenticated)

Body:
  file: File (image, max 5MB)

Response (200):
  {
    "url": "https://logos.yourdomain.com/logos/org-123-1699564800000.png"
  }

Response (400):
  { "error": "No file provided" | "Only image files are allowed" | "File size must be less than 5MB" }

Response (403):
  { "error": "Only owners can update the logo" }

Response (404):
  { "error": "No organization found" }

Response (500):
  { "error": "Storage not configured" | "Failed to upload logo" }
```

### Update Organization

```typescript
PATCH /api/organization/:id

Headers:
  Content-Type: application/json
  Cookie: session token (authenticated)

Body:
  { "logo": "https://..." | null }

Response (200):
  { "message": "Organization updated" }

Response (403):
  { "error": "Owner access required" }
```

### Get Current Organization

```typescript
GET /api/organization/current

Headers:
  Cookie: session token (authenticated)

Response (200):
  {
    "organization": {
      "id": "org-123",
      "name": "My Organization",
      "slug": "my-org",
      "logo": "https://logos.yourdomain.com/logos/org-123-1699564800000.png" | null,
      "metadata": {...},
      "createdAt": "2024-01-01T00:00:00Z",
      "role": "owner"
    }
  }
```

## Troubleshooting

### "Storage not configured" error
- Ensure R2 bucket is created in Cloudflare dashboard
- Verify `wrangler.toml` has correct R2 binding
- Check bucket name matches configuration

### Logo not displaying
- Check `R2_PUBLIC_URL` environment variable
- Verify R2 bucket has public access enabled
- Check browser console for CORS errors
- Verify URL in database matches your R2 public URL structure

### Upload button not working
- Check user is logged in as organization owner
- Check browser console for JavaScript errors
- Verify API endpoint is accessible

### "Only owners can update the logo" error
- User must be an organization owner
- Check organization membership in database
- Verify role is set to "owner"

## Support

For questions or issues:
1. Check `R2_LOGO_SETUP.md` for setup instructions
2. Review browser console for errors
3. Check Cloudflare Worker logs
4. Contact development team

## Summary

The logo upload feature is fully implemented and ready for use once the Cloudflare R2 bucket is configured. All code is production-ready with proper error handling, validation, and security measures.

