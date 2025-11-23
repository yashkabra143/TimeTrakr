# Netlify Deployment Guide

Follow these steps to deploy your TimeTrakr application to Netlify.

## Prerequisites
- You have a [Netlify account](https://www.netlify.com/).
- You have pushed your code to GitHub (which we just did: `yashkabra143/TimeTrakr`).
- You have your **NeonDB connection string** ready (starts with `postgresql://...`).

## Step 1: Create a New Site
1. Log in to your Netlify dashboard.
2. Click **"Add new site"** > **"Import from an existing project"**.
3. Select **GitHub**.
4. Authorize Netlify to access your GitHub account if asked.
5. Search for and select your repository: **`yashkabra143/TimeTrakr`**.

## Step 2: Configure Build Settings
Netlify should automatically detect the settings from the `netlify.toml` file we created. Verify they look like this:

- **Build command**: `npm run build`
- **Publish directory**: `dist/public`
- **Functions directory**: `netlify/functions` (or auto-detected)

> [!NOTE]
> If these are pre-filled, you don't need to change them.

## Step 3: Add Environment Variables (CRITICAL)
Before clicking "Deploy", you **MUST** add your environment variables. The app will not work without them.

1. Click on **"Add environment variables"** (or "Show advanced" > "New variable").
2. Add the following variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your NeonDB connection string (e.g., `postgresql://neondb_owner:...`) |
| `SESSION_SECRET` | A long random string. You can generate one by running `openssl rand -hex 32` in your terminal. |
| `NODE_VERSION` | `20` (Optional, but recommended to ensure compatibility) |

## Step 4: Deploy
1. Click **"Deploy TimeTrakr"**.
2. Netlify will start building your site. This might take a minute or two.
3. Once finished, you will get a live URL (e.g., `https://timetrakr-xyz.netlify.app`).

## Troubleshooting
- **Build Failed?** Check the "Deploy log". Common issues are missing dependencies (we installed `serverless-http`) or type errors (we fixed the known one).
- **App Loads but API Fails?** Check the "Functions" tab in Netlify. If the API returns 500 errors, it's usually because the `DATABASE_URL` is missing or incorrect.
