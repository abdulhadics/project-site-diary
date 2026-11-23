# Project Site Diary progress

## Current milestone

The photo warning is advisory and verified locally. The production release awaits the hosted Supabase setup.

## Done

- M0: local tools, GitHub, Sydney Supabase project and Vercel environments are configured. The M1 starter was deployed and verified over HTTPS.
- M2: built the persistent sign-in, settings, Postgres schema, private bucket and RLS. Executed the SQL in isolated Postgres using local Supabase role and storage fixtures. Owner isolation, cross-owner writes, geotag constraints and storage byte totals passed. Database types were generated from the migrated schema.
- M3–M4: built and tested live camera, GPS denial and retake, capture compression, photo order, notes, approvals, edits, deletion and local drafts.
- M5: restricted the AI routes to authenticated sessions. Tested the photo check and description contracts with synthetic images against Gemini, and exercised the app fallback in the browser.
- M6: verified the queue with browser fixtures for a storage quota failure, read-only database, unavailable project, expired sign-in and offline reopening. Verified the local PDF still downloads and foreground retry syncs both files and metadata.
- M7: verified separate Share activation and the download fallback in Chrome. Editing regenerates a new report and the saved PDF reopens byte-for-byte. The long-header 30-photo test generated offline with 15 A4 pages, two photos and two map links per page, separated footers, and a file below 15 MB.
- M8: added the app manifest, Home Screen icons, cached app shell, loading and error states, and the consolidated setup guide. The typecheck, production build and mobile/desktop browser checks passed.

- Gemini warnings allow Keep photo and continue, Add photo, or Retake. The browser test retained a flagged photo, approved its description, exported the PDF and synced the photo with the flag intact.
- The owner confirmed phone capture and PDF export. Their Preview showed unsynced drafts, and the hosted check confirmed the schema is absent and public signups are enabled.

## Next

- Use the [Vercel Preview](https://project-site-diary-git-diary-preview-abdulhadi-gits-projects.vercel.app/) on the diary-preview branch for the full app.
- Apply the migration in the hosted Sydney project, disable public signup, and create the intended site operator's login.
- Test the complete M1–M8 workflow on iPhone Safari and Android Chrome. Follow the grouped steps in README.md.
- Decide the commercial hosting and backup setup, activate paid Gemini for real photos, rotate the setup key and confirm the production release.

## Open issues and decisions

- Hosted Supabase Auth responded, public signups are currently enabled, and the projects table is absent. The Supabase CLI has no owner session. Apply the migration and complete the auth setup in README.md.
- The full local Supabase Docker stack could not start because the Docker image store hit a disk I/O error with low C: space. SQL was exercised in isolated Postgres and device workflows used browser service fixtures on D:.
- Actual iOS camera/location permissions, file sharing, Add to Home Screen and memory use on a real 30-photo day remain device checks.
- Vercel built commit a237aac and marked the Preview ready. The deployed diary sign-in screen opened in Chrome under the owner's Vercel session.
- The owner waived the 30% Codex stop for the Retake change and this release.
