# Parcel — a WeTransfer-style file & folder transfer app

Drop in files or a whole folder, get a tracking code (e.g. `7K2-N9Q4`) and a
link back. Anyone with the code/link can pick everything up — as individual
files or one `.zip` with folder structure intact — until it expires (7 days
by default). Optionally emails the recipient when it's ready.

React + Vite + Tailwind on the frontend. Supabase (Postgres + Storage) on the
backend. Uploads go over the TUS resumable-upload protocol so large files get
real progress and survive a flaky connection instead of failing outright.

## 1. Create the Supabase project

1. Go to https://supabase.com, create a new project.
2. In the SQL editor, paste and run everything in `supabase/schema.sql`. This creates:
   - a `transfers` table (tracking code, file list, expiry, recipient email, download count)
   - RLS policies so the public `anon` key can create and read transfers by code
   - a private `parcels` storage bucket with matching upload/read policies
   - an `increment_download_count` RPC used after a zip pickup
3. In **Project Settings → API**, copy the **Project URL** and **anon public key** (yours are already in your `.env`).

## 2. About file size limits — read this before you assume it's a bug

Supabase enforces a **global file size limit** in **Storage → Settings**
that overrides anything in this code:

| Plan | Max file size |
|---|---|
| Free | 50 MB (hard cap, cannot be raised) |
| Pro and up | up to 500 GB (you set it) |

The app's own ceiling (`MAX_TOTAL_BYTES` in `src/supabaseClient.js`) is
currently set generously to 50GB — but if your project is on the Free plan,
every upload over 50MB will still be rejected by Supabase itself, not by
this app. If you want to send large files/folders for real, you need the
**Pro plan** ($25/mo) and to raise the Global file size limit in the
dashboard. There's no way around this from the client side — it's enforced
server-side by Supabase.

## 3. Configure the app

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 4. Run it locally

```bash
npm install
npm run dev
```

Upload something, seal it, open the pickup link in another tab to test the
download/zip side.

## 5. (Optional) Turn on "email the recipient"

The checkbox in the UI is wired up but does nothing until you deploy the
edge function and give it a Resend API key:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy send-transfer-email
npx supabase secrets set RESEND_API_KEY=re_your_key_here
```

Get a free Resend API key at https://resend.com — their free tier is enough
for this. If you skip this step entirely, the checkbox still works from the
sender's side (the link/code still gets created and shown), it just won't
send an email — the function no-ops safely if the key isn't set.

## 6. Deploy to Netlify

`netlify.toml` is already set up (build command `npm run build`, publish dir
`dist`, plus a SPA redirect so `/p/:code` links survive a refresh).

1. Push to GitHub (already done).
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Confirm build command `npm run build`, publish directory `dist`.
4. **Site settings → Environment variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
5. Deploy. Links look like `https://your-site.netlify.app/p/7K2-N9Q4`.

## How it works

- **Send** (`src/components/UploadView.jsx`): drag in files or a folder (or
  use the buttons — folder picking uses the browser's native folder input).
  Folder structure is preserved via each file's relative path. Each file
  uploads via TUS (`src/lib/tusUpload.js`) directly to the `parcels` bucket
  at `CODE/relative/path`, with a live per-file progress indicator. Once
  everything's up, one row goes into `transfers` with the file list, total
  size, and an expiry timestamp. You get a code, a link, and a QR code.
- **Pickup** (`src/components/DownloadView.jsx`): looks up the transfer by
  code. Expired or missing codes get an explicit state instead of a broken
  page. Files can be grabbed individually via short-lived (2 min) signed
  URLs, or all at once as a single `.zip` (built client-side with JSZip,
  preserving the original folder structure) via the primary button.
- **Email** (`supabase/functions/send-transfer-email`): optional Edge
  Function that emails the recipient the code/link via Resend, triggered
  right after the transfer row is created.

## Not yet automated

- Nothing deletes itself yet. `supabase/schema.sql` has a commented-out
  `pg_cron` snippet that deletes expired **rows**, but a small Edge Function
  on a cron trigger is still needed to also delete the matching **files**
  from Storage (SQL can't reach into Storage). Ask if you want that built —
  it's a genuinely good idea so expired parcels don't quietly eat your
  storage quota.
- No auth/accounts — anyone with the link/code can download, same as
  WeTransfer's free tier. Don't use this for sensitive files as-is.
- No virus scanning of uploads.
- The client-side zip step downloads every file into the browser's memory
  before zipping, so a pickup with many very large files could be slow or
  memory-heavy on the recipient's device. Individual downloads don't have
  this limitation.

## Adjustable knobs

- `DEFAULT_EXPIRY_DAYS` in `src/supabaseClient.js` — how long a parcel lives.
- `MAX_TOTAL_BYTES` in `src/supabaseClient.js` — the app's own soft ceiling;
  the real ceiling is Supabase's Global file size limit (see section 2).
