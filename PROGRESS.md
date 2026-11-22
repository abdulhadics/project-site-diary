# Project Site Diary progress

## Current milestone

M0 — Accounts and tools. In progress.

## Done

- Delivered the plan and started M0 at the user's request.
- Verified Node.js 22 LTS, npm and Git. Initialized the local repository.
- Added Git exclusions for local environment files.
- Verified the public GitHub repository and linked it as the local origin.
- Prepared the environment variable template and ignored local file.
- Added the Supabase URL and publishable key to .env.local. Supabase Auth settings returned HTTP 200 using the saved values. The user confirmed the Sydney region.
- Saved Gemini credentials in the ignored local environment and verified the model lookup.

## Next

- Manual step 4 — Authorize the Vercel CLI and grant the Vercel GitHub app access to the repository. Awaiting continue.
- Finish M0 account and environment setup. Check the milestone before moving on.

## Open issues and decisions

- User will own the service accounts. Vercel project connection and environment variables remain pending.
- The source repository is public. The deployed diary requires login and stores client photos and PDFs in a private bucket.
- Use Next.js App Router and test the full 30-photo flow on the user's iPhone. Plan for iPhone 14 or newer. The exact device and iOS version are pending.
- If Gemini is unavailable, the user can write or edit the English description manually.
- The generated report preview will offer viewing and description editing. Regenerate the PDF from the revised descriptions.
- Compress large live camera photos on the phone and verify that the work remains clearly visible.
- Stop at 30% weekly Codex usage remaining.
