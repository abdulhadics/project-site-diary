# Project Site Diary progress

## Current milestone

M1 — Project setup and deploy. Local checks passed. Vercel deployment and the iPhone test are pending.

## Done

- M0 — Verified Node.js 22 LTS, npm and Git. The GitHub repository is public and main is linked to Vercel.
- Supabase Auth responded using the local project configuration. The user confirmed Sydney (ap-southeast-2).
- Gemini accepted the ignored local environment key for the configured model lookup.
- Configured and verified all four environment variables in Vercel Production and Preview. The Gemini key is stored as a Vercel secret.
- Built the Next.js App Router starter locally with TypeScript and Tailwind CSS. Vercel is configured for Next.js and Node.js 22.x.
- npm run typecheck and npm run build passed. The local production page returned 200 and rendered without layout overflow at Chrome widths 320, 390, 412 and 1440 px.

## Next

- Verify the deployed HTTPS starter and ask the user to open it in iPhone Safari.
- After the iPhone test and the user's continue, start M2 for database setup and login.

## Open issues and decisions

- User owns the service accounts. Rotate the Gemini key shared in chat before going live with client photos.
- The deployed diary will require login and store client photos and PDFs in a private bucket.
- Test the complete report workflow with 30 photos on the user's iPhone 14 or newer. Exact device and iOS version are pending.
- Offer manual English descriptions when Gemini is unavailable, and allow editing descriptions from the report preview before regenerating.
- Compress large live camera photos on the phone and verify that the work remains clearly visible.
- Stop at 30% weekly Codex usage remaining.
