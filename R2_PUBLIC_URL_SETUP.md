# R2 Public URL Setup

## ✅ What We've Done

1. ✅ Created R2 bucket: `organization-logos`
2. ✅ Added `account_id` to wrangler.toml
3. ✅ Configured R2_LOGOS binding in wrangler.toml
4. ✅ Set development R2_PUBLIC_URL to `http://localhost:8788`

## 🎯 Next Steps: Get Production R2 Public URL

### Option 1: Enable R2.dev Subdomain (Recommended for Testing)

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com/117d145849d5a8e44bfbe8389c8a28df/r2/overview
2. Click on **"organization-logos"** bucket
3. Click **"Settings"** tab
4. Find **"Public Access"** section
5. Click **"Allow Access"** or **"Enable R2.dev subdomain"**
6. Copy the public URL (will be something like: `https://pub-XXXXX.r2.dev/organization-logos`)
7. Update `wrangler.toml` line 139 with your actual URL

### Option 2: Custom Domain (Production)

1. Go to bucket settings
2. Click **"Connect Domain"**
3. Enter your custom domain (e.g., `cdn.yourdomain.com`)
4. Follow DNS setup instructions
5. Use `https://cdn.yourdomain.com/organization-logos` as your R2_PUBLIC_URL

## 📝 Update wrangler.toml

Once you have your R2 public URL, update line 139 in `wrangler.toml`:

```toml
R2_PUBLIC_URL = "https://pub-YOUR_ACCOUNT_ID.r2.dev"
```

Replace with your actual URL.

## 🧪 Test Logo Upload

Once configured, restart your dev server and try uploading a logo in the Admin Settings tab!

```bash
npm run dev
```

Then go to: http://localhost:5173/admin → Settings tab

