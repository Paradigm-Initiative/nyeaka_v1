# Nyeaka Web: Status

Snapshot of branch `november26` (2026-11-11). Written after building and testing the offer-to-handoff flow. It is separate from [README.md](README.md), which covers setup.

## TL;DR

- **Working end to end:** sign-up and sign-in, posting and managing listings and requests (with photo upload), browse and search, sending offers, accepting and declining, chat, sharing phone numbers, confirming handoffs, ratings, cancel, block, report, and automatic restriction. Plus rate limits and the lifecycle emails.
- **Not built:** ID verification (the page is a placeholder), an admin area, Google/Apple sign-up, profile pages, and any email or in-app signal for a *new chat message*.
- **Before launch:** apply the pending migrations, set the environment variables, and test email delivery for real. All of these are listed [below](#before-launch-checklist).

## What is done and where

| Area | State | Notes |
|---|---|---|
| Auth | Done | better-auth, email and password, verification email, reset password, route protection. |
| Posting | Done | Listings and requests, validation, photos to R2 via presigned URLs, edit, close, renew. 60-day expiry computed on read. |
| Browse | Done | Search, city and device filters, pagination, real data. Hides posts from restricted or blocked people. |
| Offers | Done | From listing and request pages, with a picker of your own eligible posts and reasons when one is blocked. One pending offer per donor and request. Withdraw. |
| Accept / decline / cancel | Done | Accept is one transaction (match, chat, both posts matched, other offers declined). Cancel puts both posts back to live and records who cancelled. |
| Dashboard | Done | Giving and Asking tabs from the database: offers to answer, offers you sent (and "not selected"), active matches, your posts, blocked people, ratings to give, real counts. |
| Chat | Done (v1) | Real conversations, participants only, 404 for anyone else, 10-second refresh, closed after a cancel. No realtime. |
| Phone sharing | Done | Each person opts in; a number reaches the page only when **both** have. A number is entered on first share and saved to the account (unverified). |
| Handoff and ratings | Done | Both confirm; ratings after a handoff, or after a cancel if both people messaged; 30 days; never after a block. |
| Safety | Done | Block, report, restriction. Rules below. |
| Rate limits | Done | See below. |
| Emails | Done, untested live | Offer received, accepted, not selected, match cancelled, report (to admin), restriction (to admin and the user). |
| Tests | Done | 130 tests in 9 files on an in-memory Postgres running the real migrations. Browser flows were also run by hand in Chrome against a throwaway database (those scripts are not in the repo). |

## Rules in force

| Rule | Value |
|---|---|
| Offers per donor and request | One `PENDING` at a time (database index and a service check). |
| Rate limits per user | Messages 20 a minute and 500 a day; offers 10 a day; new listings 5 a day; new requests 5 a day; reports 5 a day; blocks 20 a day. Counted from existing rows, so it is a soft limit that can overshoot by one under a simultaneous race. |
| Report | Only against someone you have a match (and so a chat) with. From the thread, the dashboard, or a listing or request page where you chatted with the poster. One open report per person. |
| Block | Needs a match. Declines pending offers between you, cancels active matches, stops messages and offers both ways, hides each other's posts. The blocked person is never told. |
| Restriction | Automatic at **3 reports** from different people **or 5 blocks** from different people (dismissed reports don't count). A restricted user can't create listings, requests or offers, and their posts are hidden from others. They can still sign in, browse, chat and finish existing matches. |
| Rating window | 30 days after the handoff or cancel. One rating each. |
| Phone numbers | Shown only when both opted in, and only while the match is not cancelled and nobody has blocked. Never in emails. |

## Before launch checklist

1. **Apply the migrations.** Four were written during this work and have only been run against the in-memory test database: `20261110120000_offer_donor_and_match_handoff`, `20261110180000_rate_limit_indexes`, `20261110200000_safety_restriction_and_reports`, `20261111100000_match_cancelled_by`. Run `pnpm exec prisma migrate status` against Neon, then `migrate deploy`. The safety migration makes `Report.reportedUserId` required and fills it for old reports; it will fail loudly (not drop data) if a report's target was already deleted (the check is in the migration's comment).
2. **Set `BETTER_AUTH_URL` to the real site address.** Email links use it and fall back to localhost.
3. **Set `ADMIN_EMAIL`**, or reports and restriction notices won't reach anyone.
4. **Send a real email of each kind** with a live `SENDBYTE_KEY`. The browser runs used a fake key, so only that the send was attempted is verified, not delivery or how the emails look in a mail client.
5. **Try two simultaneous accepts** on a Neon dev branch. The in-memory test database is a single session, so the race can't be reproduced there. The code uses conditional updates inside one transaction, which is the correct pattern, but it has not been exercised in parallel.
6. **Decide what to do about ID verification** (below), since several screens show "ID-verified" badges that nobody can earn.

## Known gaps

### Not built
- **ID verification.** `/verify` is a placeholder: the NIN field and uploads do nothing, and the "Verification submitted" toast saves nothing. Nothing in the app ever sets `idVerified`, so the badge only appears on seeded or hand-edited users. The post pages' copy also claims verification comes first, but nothing enforces it.
- **No notification for a new chat message.** The chat only refreshes while the page is open. Nobody is emailed or badged when someone writes to them, so a reply can sit unseen. `Message.readAt` is saved but not shown anywhere. This is probably the biggest practical gap.
- **No admin area.** Reports are reviewed from the email; a report's status, a restriction, a user's role and `idVerified` are changed in the database only. The app never writes a report's status or a user's role.
- **No profile page.** The user menu links every signed-in user to `/profile`, which is a 404. Admins also see an `/admin` link, which is a 404 too.
- **Google and Apple sign-up** buttons show a "not implemented" toast.
- **Rating comments are saved but not shown** anywhere; only the average is.
- **Declined offers send no email** (the sender sees "Not selected" on the dashboard).

### Limits of what exists
- **A match where only one person confirms the handoff stays active** forever; ratings never open. An auto-close after about 14 days would fix it, but there are no scheduled jobs.
- **Nothing expires posts in the background.** A post past `expiresAt` is treated as expired when read.
- **Ratings are visible immediately**, so a rating given in retaliation is possible. Hiding both until both are in is an option.
- **Phone numbers are stored as typed**, unverified, with no country formatting. Stopping sharing can't un-show a number someone already saw.
- **Rate limits** don't cover photo uploads or sign-in. better-auth applies its own default limiter in production only (window 10 s, 100 requests, stored in memory per instance), which has not been tuned here.
- **Restricted users still see** "Edit" and "List another device" on their dashboard; the server refuses the action.
- **After lifting a restriction**, unfounded reports must be set to `DISMISSED` first, or the next report or block restricts the user again.

### Housekeeping
- The Docker build and `output: "standalone"` are untested.
- `components/user-avatar.tsx` and `components/ui/input-group.tsx` are unused.
- `apps/socket` is an empty stub; chat does not use it.
- `lib/auth.ts` has the `secret` line commented out; better-auth reads `BETTER_AUTH_SECRET` from the environment on its own.
- `README` previously listed `DATABASE_URL_UNPOOLED`; nothing uses it.
