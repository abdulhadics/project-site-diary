# Project Site Diary progress

## Current milestone

The Start new report flow is implemented and tested. Production deployment is pending.

## Done

- M0: local tools, GitHub, Sydney Supabase project and Vercel environments are configured. The M1 starter was deployed and verified over HTTPS.
- M2: built the persistent sign-in, settings, Postgres schema, private bucket and RLS. Executed the SQL in isolated Postgres using local Supabase role and storage fixtures. Owner isolation, cross-owner writes, geotag constraints and storage byte totals passed. Database types were generated from the migrated schema.
- M3–M4: built and tested live camera, GPS denial and retake, capture compression, photo order, notes, approvals, edits, deletion and local drafts.
- M5: restricted the AI routes to authenticated sessions. Tested the photo check and description contracts with synthetic images against Gemini, and exercised the app fallback in the browser.
- M6: verified the queue with browser fixtures for a storage quota failure, read-only database, unavailable project, expired sign-in and offline reopening. Verified the local PDF still downloads and foreground retry syncs both files and metadata.
- M7: verified separate Share activation and the download fallback in Chrome. Editing regenerates a new report and the saved PDF reopens byte-for-byte. The long-header 30-photo test generated offline with 15 A4 pages, two photos and two map links per page, separated footers, and a file below 15 MB.
- M8: added the app manifest, Home Screen icons, cached app shell, loading and error states, and the consolidated setup guide. The typecheck, production build and mobile/desktop browser checks passed.

- Gemini warnings allow Keep photo and continue, Add photo, or Retake. The browser test retained a flagged photo, approved its description, exported the PDF and synced the photo with the flag intact.
- The owner confirmed phone capture and PDF export. Their Preview showed unsynced drafts. The owner applied the Sydney migration, and all four hosted tables now deny anonymous reads.

- Start new report opens a separate named project and an empty draft for today. History retains photos and PDFs by project and date.
- Browser tests passed for a legacy draft upgrade, offline creation, same-day report isolation, original PDF integrity and syncing both projects. Typecheck and production build passed.

## Next

- Open [Production](https://project-site-diary.vercel.app/) and use the existing diary account. The tested commit af13bd3 is deployed from main.
- Retry sync for existing Preview drafts before switching URLs. Public signups are disabled and the hosted diary tables are in place.
- Test the complete M1–M8 workflow on iPhone Safari and Android Chrome. Follow the grouped steps in README.md.
- Decide the commercial hosting and backup setup, activate paid Gemini for real photos, rotate the setup key and confirm the production release.

## Open issues and decisions

- Verified public signups are disabled in hosted Supabase Auth and anonymous requests are denied for all four diary tables.
- The full local Supabase Docker stack could not start because the Docker image store hit a disk I/O error with low C: space. SQL was exercised in isolated Postgres and device workflows used browser service fixtures on D:.
- Actual iOS camera/location permissions, file sharing, Add to Home Screen and memory use on a real 30-photo day remain device checks.
- Vercel built commit af13bd3, with both Preview and Production marked Ready. The production URL returned the diary and an anonymous AI request returned 401.
- The owner waived the 30% Codex stop for the Retake change and this release.
