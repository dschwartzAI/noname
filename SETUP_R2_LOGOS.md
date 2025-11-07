# Setup R2 Bucket for Logo Storage

To enable logo uploads, you need to set up a Cloudflare R2 bucket.

## Step 1: Create R2 Bucket in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on **R2** in the left sidebar
3. Click **Create bucket**
4. Name it: `organization-logos`
5. Choose your preferred location
6. Click **Create bucket**

## Step 2: Get Bucket Name

After creation, note down the bucket name: `organization-logos`

## Step 3: Update wrangler.toml

Add the R2 bucket binding to your `wrangler.toml`:

```toml
# Add this after the KV namespaces section
[[r2_buckets]]
binding = "R2_LOGOS"
bucket_name = "organization-logos"

# Also add it to the development environment
[env.development]
# ... existing config ...

[[env.development.r2_buckets]]
binding = "R2_LOGOS"
bucket_name = "organization-logos"
```

## Step 4: Set Up Public Access (Optional but Recommended)

### Option A: Custom Domain (Best for Production)

1. In your R2 bucket settings, go to **Settings** > **Custom Domains**
2. Click **Connect Domain**
3. Add your domain (e.g., `logos.yourcompany.com`)
4. Follow DNS setup instructions

### Option B: Public URL via Workers (Development)

For development, you can use the R2 dev URL or create a simple worker:

```typescript
// r2-public.worker.ts
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    
    const object = await env.R2_LOGOS.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000');
    
    return new Response(object.body, { headers });
  }
};
```

## Step 5: Add Environment Variable

Add to your `wrangler.toml` in the `[env.development.vars]` section:

```toml
R2_PUBLIC_URL = "https://your-worker.your-account.workers.dev"
# OR if using custom domain:
R2_PUBLIC_URL = "https://logos.yourcompany.com"
```

## Step 6: Restart Dev Server

```bash
npm run dev
# or
pnpm dev
```

## Alternative: Use URL-Based Storage (Quick Fix)

If you want to get started quickly without R2, you can modify the logo upload to use a URL instead:

1. Upload logo to any image host (Imgur, Cloudinary, etc.)
2. Copy the public URL
3. Manually update your organization in the database:

```sql
UPDATE organization 
SET logo = 'https://your-image-url.com/logo.png'
WHERE slug = 'soloos';
```

Then refresh your browser and the logo will appear!

## Verify It Works

1. Go to **Admin** > **Settings** tab
2. Click **Choose Image** and select a logo
3. Click **Upload Logo**
4. You should see a success message
5. The logo should appear in the sidebar

## Troubleshooting

### "Storage not configured" error
- Make sure you created the R2 bucket
- Verify the bucket name is `organization-logos`
- Check that wrangler.toml has the R2 binding
- Restart your dev server

### Logo doesn't display
- Check the `R2_PUBLIC_URL` environment variable
- Verify the bucket has public access configured
- Check browser console for CORS errors

## Cost

R2 Storage is very affordable:
- First 10 GB/month: FREE
- Storage: $0.015/GB/month
- Class A operations: $4.50 per million
- Class B operations: $0.36 per million

Logo files are typically < 1MB, so cost is negligible for most use cases.

