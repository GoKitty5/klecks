# Netlify Deployment Guide for Klecks

This guide walks you through deploying the Klecks drawing app to Netlify with all recent improvements (8000px canvas limit, device capability warnings, and tiled Noise filter).

## Prerequisites

- **GitHub account** with the Klecks repository
- **Netlify account** (free tier is sufficient)
- Recent commits pushed to the `main` branch

## Quick Deployment (5 minutes)

### Option 1: Connect GitHub Repository (Recommended)

1. **Log in to Netlify:**
   - Go to https://app.netlify.com
   - Sign in with your GitHub account (or create a Netlify account)

2. **Connect Repository:**
   - Click **"New site from Git"** (or **"Add new site"** → **"Import an existing project"**)
   - Choose **GitHub** as the Git provider
   - Authorize Netlify to access your repositories
   - Select the **klecks** repository

3. **Configure Build Settings:**
   - **Build command:** `npm run build` *(pre-filled if netlify.toml is detected)*
   - **Publish directory:** `dist`
   - **Node version:** 18 *(already set in netlify.toml)*
   - Click **"Deploy site"**

4. **Netlify builds and deploys:**
   - Build log appears in real-time
   - Once complete, you'll get a live URL (e.g., `https://[random-name].netlify.app`)

### Option 2: Deploy from Command Line (if already set up)

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## Post-Deployment Verification

After deployment completes, test the production build:

### 1. **Open the Live Site**
   - Visit the Netlify URL provided (e.g., `https://klecks.netlify.app`)

### 2. **Test New Image Dialog (Device Warnings)**
   - Click **"New Image"** from the menu
   - Try setting dimensions to **7000 × 7000**
   - **Expected:** Red warning text appears ("Selected size may exceed device capabilities...")
   - **Confirm:** Input max is clamped to device capabilities

### 3. **Test Large Canvas Creation**
   - Create a **7000 × 7000** canvas
   - **Expected:** Canvas renders without freezing; device warning appears

### 4. **Test Noise Filter on Large Canvas**
   - With a **7000 × 7000** canvas active:
     - Go to **Filters** menu
     - Select **Noise** (or **Static**)
     - Click **Apply**
   - **Expected:** Filter completes successfully (may take 10-30 seconds for very large canvas)
   - **Result:** Seamless noise pattern fills the entire canvas without corruption

### 5. **Check Browser Console (F12)**
   - Open **DevTools** (F12) → **Console** tab
   - Perform the Noise filter test again
   - **Expected:** No JavaScript errors

## Troubleshooting

### Build Fails with "Cannot find module"
- **Solution:** Ensure `netlify.toml` specifies Node version 18:
  ```toml
  [build.environment]
    NODE_VERSION = "18"
  ```

### Canvas Size Still Limited to 4096
- **Solution:** Verify both files were updated:
  - `src/app/script/app/kl-app.ts` — `maxCanvasSize = 8000`
  - `src/app/script/app/kl-app-import-handler.ts` — `maxResolution = 8000`
- Rebuild and redeploy: `npm run build` + redeploy to Netlify

### Noise Filter Hangs or Crashes on Large Canvas
- **Expected behavior:** Tiled rendering fallback should handle this
- **Check:** Verify `src/app/script/fx-canvas/filters/noise.ts` includes tiled rendering code
- If still failing: Reduce canvas size to 5000×5000 and retry

### Device Warnings Not Appearing
- **Solution:** Clear cache (Ctrl+Shift+R) and reload
- Verify `src/app/script/klecks/ui/modals/new-image-dialog.ts` has device detection code (lines 69–89)

## Recent Changes Deployed

| File | Change | Impact |
|------|--------|--------|
| `src/app/script/app/kl-app.ts` | `maxCanvasSize: 8000` | Allows 8000px canvases |
| `src/app/script/app/kl-app-import-handler.ts` | `maxResolution: 8000` | Allows importing large images |
| `src/app/script/klecks/ui/modals/new-image-dialog.ts` | Device detection + warnings | UI clamping to device limits |
| `src/app/script/fx-canvas/filters/noise.ts` | Tiled rendering fallback | Large canvases no longer fail |
| `src/app/script/fx-canvas/shaders/shader-noise-tiled.glsl` | New tiled shader | Seamless noise across tiles |

## Environment & Build Info

- **Build tool:** Parcel 2.16.0
- **TypeScript:** Latest (via tsconfig.json)
- **Shaders:** GLSL (transformed via @parcel/transformer-glsl)
- **Node:** 18+ required
- **Output:** Static files in `dist/` directory

## Rollback

If you need to revert to the previous version:

1. Go to Netlify dashboard → **Deploys** tab
2. Find the previous deploy
3. Click the three dots → **Publish deploy**

Or, in Git:
```bash
git revert HEAD~1  # Revert the most recent commit
git push
# Netlify will auto-rebuild from the new HEAD
```

## Support

- **Local testing:** `npm run start` (runs dev server on http://localhost:1234)
- **Production build:** `npm run build` (generates `dist/` artifacts)
- **Logs:** Check Netlify dashboard → **Deploys** → **Deploy log**

---

**Status:** Ready to deploy. All changes are in `main` branch and tested locally.
