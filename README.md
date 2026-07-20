# Parcel — a WeTransfer-style file transfer app

Drop files in, seal the parcel, get a tracking code (e.g. `7K2-N9Q4`). Anyone with
the code (or link) can pick the files up until the parcel expires (7 days by
default). Built with React + Vite + Tailwind on the frontend, Supabase
(Postgres + Storage) on the backend.

## 1. Create the Supabase project

1. Go to https://supabase.com, create a new project.
2. In the SQL editor, paste and run everything in `supabase/schema.sql`.
   This creates:
   - a `transfers` table (tracking code, file list, expiry, download count)
   - RLS policies so the public `anon` key can create and read transfers by code
   - a private `parcels` storage bucket with matching upload/read policies
   - an `increment_download_count` RPC used after a pickup
3. In **Project Settings → API**, copy the **Project URL** and **anon public key**.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Upload a file, seal it, then open the pickup
link it gives you (in another tab/incognito window) to test the download side.

## 4. Deploy to Netlify

This repo already includes `netlify.toml` (build command `npm run build`,
publish directory `dist`, plus a SPA redirect so `/p/:code` links work on
refresh — without it Netlify 404s on any route but `/`).

1. Push this project to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build settings should auto-fill from `netlify.toml`. If Netlify shows a
   framework-detection mismatch (e.g. defaults to a different preset), confirm
   the build command is `npm run build` and publish directory is `dist`.
4. Under **Site settings → Environment variables**, add `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` with the same values as your local `.env`.
5. Deploy. Your live tracking links will look like
   `https://your-site.netlify.app/p/7K2-N9Q4`.

## How it works

- **Upload** (`src/components/UploadView.jsx`): files are uploaded straight
  from the browser to the `parcels` bucket at `CODE/filename`, then one row
  is inserted into `transfers` with the file list, total size, and an
  `expires_at` timestamp.
- **Pickup** (`src/components/DownloadView.jsx`): looks up the `transfers` row
  by code. If it's expired, shows an "expired" state instead of files. Each
  file is downloaded via a 60-second signed URL (not a permanently public
  link), generated on demand.
- Nothing is actually deleted automatically yet — `supabase/schema.sql` has a
  commented-out `pg_cron` snippet at the bottom that deletes expired *rows*.
  You'd still want a small Supabase Edge Function on a cron trigger to also
  delete the matching files from Storage, since SQL alone can't reach into
  the Storage bucket. Happy to build that next if you want full auto-cleanup.

## Adjustable knobs

- `DEFAULT_EXPIRY_DAYS` in `src/supabaseClient.js` — how long a parcel lives.
- `MAX_TOTAL_BYTES` in `src/components/UploadView.jsx` — per-parcel size cap
  (currently a 2GB soft cap; check it against your Supabase plan's storage
  and upload limits before raising it).

## What's intentionally not included

- No auth/accounts — like WeTransfer's free tier, anyone with the link can
  download. Don't use this for anything sensitive as-is.
- No virus scanning of uploads.
- No email notifications on send (WeTransfer's "send by email" flow) — this
  is link/code only. Could be added with a Supabase Edge Function + an email
  provider if you want it.
