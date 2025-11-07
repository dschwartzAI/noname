# R2 Logo Storage Setup

This document explains how to set up Cloudflare R2 bucket for organization logo storage.

## Overview

The application uses Cloudflare R2 (similar to AWS S3) to store organization logos. Logos are uploaded through the Admin panel and displayed in the sidebar.

## Setup Instructions

### 1. Create R2 Bucket

1. Go to your Cloudflare Dashboard
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it: `organization-logos` (or your preferred name)
5. Choose your location preference
6. Click **Create bucket**

### 2. Configure Public Access

You have two options for serving logos:

#### Option A: Public Bucket with Custom Domain (Recommended)

1. In the R2 bucket settings, go to **Settings** tab
2. Under **Public Access**, click **Allow Access**
3. Set up a custom domain:
   - Go to **Settings** > **Custom Domains**
   - Click **Connect Domain**
   - Add your domain (e.g., `logos.yourdomain.com`)
   - Follow DNS setup instructions

Your public URL will be: `https://logos.yourdomain.com`

#### Option B: Cloudflare Workers Public URL

Use Cloudflare Workers to serve files from your R2 bucket.

Create a worker (`r2-public-logos`) with this code:

```typescript
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Remove leading slash

    if (!key) {
      return new Response('Not found', { status: 404 });
    }

    const object = await env.R2_LOGOS.get(key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  }
};
```

Bind the R2 bucket to this worker and deploy it. Your public URL will be the worker URL.

### 3. Update Environment Variables

Add to your `.env.local` or Cloudflare Worker environment variables:

```env
R2_PUBLIC_URL=https://logos.yourdomain.com
# OR
R2_PUBLIC_URL=https://r2-public-logos.your-account.workers.dev
```

### 4. Update wrangler.toml

Add the R2 bucket binding to your `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2_LOGOS"
bucket_name = "organization-logos"

[env.development]
[[env.development.r2_buckets]]
binding = "R2_LOGOS"
bucket_name = "organization-logos"
```

### 5. CORS Configuration (If Using Custom Domain)

If you're using a custom domain, you may need to configure CORS:

1. Go to your R2 bucket settings
2. Navigate to **CORS policy**
3. Add a CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:5174"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Access Control

### Owner-Only Upload

The current implementation restricts logo uploads to organization owners only. This is enforced in the API:

```typescript
if (membership.role !== 'owner') {
  return c.json({ error: 'Only owners can update the logo' }, 403);
}
```

### Public Read Access

Logos are publicly readable once uploaded. This is necessary for them to display in the application.

### File Size and Type Restrictions

The application enforces:
- **Max file size**: 5MB
- **Allowed types**: Images only (PNG, JPG, GIF, SVG, WebP)

## File Structure

Files are stored with the following naming convention:

```
logos/
  └── {organizationId}-{timestamp}.{extension}
```

Example: `logos/org-123-1699564800000.png`

This prevents filename collisions and allows easy cleanup of old logos if needed.

## Database Schema

The organization table stores the logo URL:

```sql
CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,  -- URL to R2 logo
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## Usage

### Admin Panel

1. Navigate to **Admin** > **Settings** tab
2. Click **Choose Image** under Logo section
3. Select an image file (max 5MB)
4. Click **Upload Logo**
5. The logo will appear in the sidebar immediately

### Removing a Logo

Click the **X** button on the logo preview to remove it. This will:
- Update the database to set `logo` to `null`
- The old file remains in R2 (for now)
- Future enhancement: Delete old files from R2

## Security Considerations

1. **Owner Access**: Only organization owners can upload/change logos
2. **File Validation**: Server-side validation of file type and size
3. **Filename Sanitization**: Generated filenames prevent path traversal
4. **Public URLs**: Logos are public by design (displayed to all org members)

## Troubleshooting

### Logo not displaying

1. Check R2 bucket public access settings
2. Verify `R2_PUBLIC_URL` environment variable is set correctly
3. Check browser console for CORS errors
4. Verify the logo URL in the database matches your R2 public URL structure

### Upload failing

1. Check R2 bucket binding in `wrangler.toml`
2. Verify user is an organization owner
3. Check file size is under 5MB
4. Check file type is an image
5. Check Cloudflare Worker logs for errors

### CORS errors

1. Add your frontend URL to R2 CORS policy
2. Include development URLs (localhost) for testing
3. Ensure CORS headers include `AllowedHeaders: ["*"]`

## Future Enhancements

- [ ] Automatic deletion of old logos when a new one is uploaded
- [ ] Image optimization/resizing server-side
- [ ] Support for multiple logo sizes (favicon, sidebar, header, etc.)
- [ ] Logo versioning/history
- [ ] Bulk logo upload for multiple organizations (God mode)

## API Endpoints

### Upload Logo

```
POST /api/organization/logo/upload
Content-Type: multipart/form-data

Body:
  file: <image file>

Response:
  { "url": "https://logos.yourdomain.com/logos/org-123-1699564800000.png" }
```

### Update Organization Logo

```
PATCH /api/organization/:id
Content-Type: application/json

Body:
  { "logo": "https://logos.yourdomain.com/logos/org-123-1699564800000.png" }

Response:
  { "message": "Organization updated" }
```

### Remove Logo

```
PATCH /api/organization/:id
Content-Type: application/json

Body:
  { "logo": null }

Response:
  { "message": "Organization updated" }
```

## Support

For issues or questions, contact the development team or create an issue in the project repository.

