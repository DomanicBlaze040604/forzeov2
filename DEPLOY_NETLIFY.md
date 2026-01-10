# Netlify Deployment Guide

## Prerequisites ✅

- [x] Production build tested (`npm run build` passed)
- [x] `netlify.toml` configured
- [x] Code pushed to GitHub: https://github.com/DomanicBlaze040604/forzeov2.git
- [x] Edge functions deployed to Supabase

---

## Deploy to Netlify

### Step 1: Connect Repository

1. Go to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** → Authorize if needed
4. Select repository: `DomanicBlaze040604/forzeov2`

### Step 2: Configure Build Settings

Netlify should auto-detect from `netlify.toml`, but verify:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 18 (or latest LTS) |

### Step 3: Add Environment Variables

Go to **Site settings** → **Environment variables** → **Add**:

```
VITE_SUPABASE_URL = https://bvmwnxargzlfheiwyget.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_JZUOFsqpHv9QqltRPwQnew_S2ch4yNY
VITE_SUPABASE_PROJECT_ID = bvmwnxargzlfheiwyget
```

> **Note:** DATAFORSEO and other API keys are already configured as Supabase Edge Function secrets, so they don't need to be added to Netlify.

### Step 4: Deploy

1. Click **"Deploy site"**
2. Wait for build to complete (~1-2 minutes)
3. Your site will be live at: `https://your-site-name.netlify.app`

---

## Custom Domain (Optional)

1. Go to **Domain settings**
2. Click **"Add custom domain"**
3. Follow DNS configuration instructions

---

## Troubleshooting

### Build Fails
- Check Node version (needs 18+)
- Verify all dependencies in `package.json`

### API Errors After Deploy
- Ensure environment variables are set correctly
- Check that edge functions are deployed with `--no-verify-jwt`

### Blank Page
- Check browser console for errors
- Verify Supabase URL and key are correct

---

## Post-Deployment Checklist

- [ ] Visit deployed site
- [ ] Create a test client
- [ ] Add a prompt
- [ ] Run an audit
- [ ] Verify citations are saved
- [ ] Check API cost tracking

---

## Your Supabase Configuration

| Service | Status |
|---------|--------|
| Database | ✅ 19 tables deployed |
| Edge Functions | ✅ 5 functions deployed |
| Secrets | ✅ DataForSEO configured |
| Storage | ✅ Working |

**Everything is ready for production!** 🚀
