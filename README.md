# Project Site Diary

A private mobile diary for construction progress. Capture geotagged site photos, approve English descriptions and export an A4 PDF for the selected day.

After saving a PDF, tap **Start new report** beside Site photos or in the report preview. Enter a project name to open an empty draft. History shows previous drafts and PDFs by project and date.

## Run locally

Use Node.js 22 LTS. On Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [the local app](http://localhost:3000/). Copy `.env.example` to `.env.local` when starting from a fresh checkout. Fill in the Supabase URL and publishable key, plus the server-side Gemini key and model name. The existing checkout already has a local environment file. For repeatable checks, run `npm.cmd run typecheck` and `npm.cmd run build`. Use `npm.cmd start` after a build to test the offline shell locally.

## Account and device handover

Complete these steps before the client starts using real site photos.

### MANUAL STEP 5: Apply the Sydney database migration

Do:

1. On the [Supabase dashboard](https://supabase.com/dashboard/projects), open the Sydney project and select **SQL Editor → New query**.
2. Paste the full [initial migration](supabase/migrations/20261123030000_initial_diary.sql) into the editor and click **Run**.
3. Open **Table Editor** and **Storage** to inspect the result.

Check: the query succeeds, `projects`, `entries`, `photos` and `reports` appear with RLS, and the `site-diary` bucket is private.

Send me: the success status, or the SQL error text with any credentials removed.

### MANUAL STEP 6: Provision the single login

Do:

1. In Supabase Authentication settings, turn off **Allow new users to sign up** and save. Keep email/password sign-in enabled.
2. Go to **Authentication → Users → Add user → Create new user**. Enter the chosen operator email and a password, and confirm the user.
3. In **Authentication → URL Configuration**, use the intended production HTTPS domain as **Site URL**. Add the exact preview and production URLs to the redirect allowlist when needed.

Check: the intended account appears in **Users**. The Preview sign-in form accepts it. Settings saves the project name.

Send me: confirmation that signup is off and the operator can sign in.

### MANUAL STEP 7: Verify the phones

Do:

1. Open the Preview on iPhone Safari. Sign in, save the project settings and reopen the browser to check the session.
2. Test a denied location permission, then allow location and take five test photos. Include blurry and dark images. Try Keep photo and continue, Retake, and an Urdu or Roman Urdu note. Confirm the capture times and GPS accuracy in the diary.
3. Approve the English descriptions. Turn on airplane mode, reopen the diary, edit a description and generate a PDF from the saved photos. Reconnect and check that sync finishes.
4. Read the preview, edit a description and regenerate. Open the older saved PDF from the day to check that the original is still available.
5. On a 30-photo test day, verify the portrait report, two photos per page, map link and file size. Tap Share after generation, try **Save to Files** and WhatsApp, then test **Download**.
6. Add the app to Home Screen. Verify sign-in, camera, location and PDF download in Android Chrome too.

Check: the workflow succeeds from capture to sharing. A 30-photo report has 15 A4 pages and fits under 15 MB.

Send me: iPhone model and iOS version, Android test result, and any failed step or screenshot.

### MANUAL STEP 8: Approve client go-live

Do:

1. Set up the commercial hosting plan before actual client use. Recheck [Vercel's current plan terms](https://vercel.com/docs/plans/hobby) near launch.
2. Enable paid [Gemini billing](https://aistudio.google.com/docs/billing) before sending real photos. Replace the setup key in `.env.local` and Vercel **Production** and **Preview**, then retire the old key in Google AI Studio.
3. Confirm the Vercel environment settings, Supabase Auth URLs and owner account. Release the verified branch to the production domain and repeat the phone sign-in and PDF smoke check.

Check: the production site uses the intended accounts and a fresh key, and the operator can share a PDF from the phone.

Send me: the approved launch setup and any release issue.

## Backups and downtime

The app stores drafts and generated reports in the phone's browser and retries cloud writes while it is open. Download important PDFs to Files, especially when the app shows a cloud error. Browser storage can be removed by the operating system.

[Supabase Free](https://supabase.com/pricing) has a 500 MB database, 1 GB of file storage, inactivity pausing and no automatic backups. Use a paid plan when the client needs continuous operation. [Database backups](https://supabase.com/docs/guides/platform/backups) cover database records. Keep an independent private copy of the photo and PDF files.

The database and bucket are in Sydney. The configured Gemini API processes the reduced image and note. Review the [Gemini API terms](https://aistudio.google.com/docs/terms#data-use-paid) for its processing and retention before using client material.
