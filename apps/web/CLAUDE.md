@AGENTS.md

## Project scope (locked decisions)

- **Africa-wide by design.** Nyeaka is not Nigeria-only. Nigeria (`NG`) is the only *enabled* country at launch; every other country is switched on in `lib/countries.ts` (`enabled: true`) once its legal read is done. Nothing in the schema, copy, phone handling or verification flow may assume Nigerian documents, phone numbers or law.
- **Same-country matching only (v1).** Handoff is in person, so listings, requests and offers only pair people in the same country. Cross-border matching stays off until decided otherwise.
- **Country is required.** `User.countryCode` (ISO 3166-1 alpha-2) is set at signup. Browse defaults to the user's own country.
- **Phone numbers** are stored as E.164. SMS OTP is per-country and only where delivery is confirmed; otherwise rely on email verification.
- **KYC is manual review for now.** Automated verification providers are deferred, per country. ID numbers are never stored in plain text, only as an HMAC (`docNumberHash`). ID images live in a private R2 bucket, are viewed only through short-lived signed URLs, and are deleted 30 days after the decision.
- **Gating.** `User.idVerificationStatus === VERIFIED` is required to create listings, requests and offers, enforced server-side. `idVerificationStatus` is the single source of truth (there is no `idVerified` boolean).
- **Roles.** Keep the existing `Role` enum; only `ADMIN` is special. Enforce it in the proxy/middleware and again inside every admin server action.
- **Deployment.** Vercel now, then Docker on a Coolify server. Scheduled jobs are protected route handlers (`Authorization: Bearer $CRON_SECRET`), triggered by Vercel Cron today and a Coolify scheduled task later. Do not depend on Cloudflare Workers or Cron Triggers.
- **i18n is coming; do not hard-code English.** All user-facing copy (forms, errors, emails, notices, legal pages) must live in one central place keyed for translation, not inline in components or services. Services should throw error *codes* the UI translates, not English sentences. Use locale-aware formatting for dates, numbers and country names (`Intl`). Don't build layouts that assume English text length. The admin area is English only for now, so it needs no translation.
