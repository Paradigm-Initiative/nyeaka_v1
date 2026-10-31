# Nyeaka Web: Code Summary and Status

Snapshot of branch `feat-auth` (2026-10-31). Written from a read-through of the code. It is separate from `README.md`, which covers setup.

## TL;DR

- **Real and working:** sign-up, sign-in, sessions, sign-out, route protection, the database schema, and the full UI shell.
- **Fake (hard-coded mock data):** every listing, request, dashboard number, chat message and rating you see on screen.
- **Missing:** every server action is an empty file. No form saves anything to the database. Email/OTP sending, ID verification, messaging and matching are not built.

In short, the frontend is mostly a clickable prototype. Auth is the only feature wired to a backend.

---

## What is done

| Area | State | Notes |
|---|---|---|
| Auth (email + password) | Done | better-auth with the Prisma adapter. `firstName`/`lastName` are extra fields, and `name` is composed in a `databaseHooks` user-create hook. |
| Sessions | Done | `lib/get-session.ts` for server components, `useSession` for client components. |
| Sign out | Done | In the user dropdown. |
| Route protection | Partly done | `/dashboard`, `/verify` and `/messages/*` redirect to sign-in. `/listings/new` and `/requests/new` show a "sign in required" screen. |
| DB schema + migrations | Done | `User`, `Listing`, `DeviceSpec`, `Request`, `RequestSpec`, `Session`, `Account`, `Verification`, plus enums. 2 migrations. |
| Form validation | Done for auth only | Zod schemas for sign-up (10+ chars, upper, lower, number, special) and sign-in. |
| UI components | Done | shadcn-style `ui/*`, custom `FieldInput`, header, footer, mobile menu, avatar, dropdown, toasts. |
| Marketing home page | Done | Hero, how-it-works, recent listings, trust section, CTA banner. |
| Brand/styling (uncommitted) | Done | Paradigm Initiative logo and icons, Tailwind 4 theme in `globals.css`, `OrganicEdge` divider. |

## What is NOT done

### Blockers (core product doesn't function without these)

1. **All server actions are empty:** `actions/auth.ts`, `listings.ts`, `matchings.ts` and `requests.ts` are 0 bytes.
2. **No real data.** Pages read `LISTINGS` and `REQUESTS` from `data/marketplace-data.ts`. Nothing queries Prisma.
3. **Posting forms don't save.** `PostListingForm` and `PostRequestForm` only call `setPublished(true)`. No DB write, no photo upload and no validation beyond the HTML `required` attribute.
4. **Contact/offer form doesn't send.** `ContactForm` only calls `setSent(true)`.
5. **Email delivery is a stub.** `sendVerificationOTP` in `lib/auth.ts` has empty branches. No email provider is wired in. Sign-up sets `callbackURL: "/email-verified"`, but no verification email is sent, so `emailVerified` never becomes true.
6. **Messaging doesn't exist.** `ChatThread` uses `MOCK_CHAT_THREAD` in local state. `apps/socket` has only `socket.io` in `node_modules`, with no server code. There is no `Message` or `Thread` model in the schema.
7. **Offers/matching have no DB model.** `models/offers.ts` is a mock array with statuses PENDING, ACCEPTED and DECLINED. The Prisma schema has no `Offer` model, and the choose and decline buttons do nothing.

### Other gaps

- **Identity verification** (`VerifyForm`): the NIN input and ID/selfie boxes are placeholders. "Verify and continue" shows a toast and redirects. The NIN check, file upload, reviewer flow and `idVerificationStatus` updates are not built. The copy also claims "Phone confirmed — done at sign-up", but there is no phone step at sign-up.
- **Dashboard** (`DashboardView`): all numbers are hard-coded ("4.9 ★, 11 reviews", "6 handoffs", "Verified", "HP ProBook 450"). The Giving/Asking toggle is local state only. Decline and Report do nothing.
- **Ratings and handoff confirmation:** local state only. Nothing is persisted, and there is no ratings model.
- **Roles:** the `Role` enum exists (`GUEST` is the default), but nothing sets or enforces it. `UserDropdown` checks `user.role === "admin"`, while the enum value is `ADMIN`, so the admin link never shows. Role is also not exposed in `additionalFields`.
- **Dead links:** `/profile`, `/admin`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms` and `/contact` have no pages. The README lists forgot/reset pages that don't exist.
- **Logged-in redirect:** `app/(auth)/layout.tsx` has `// TODO: Redirect already logged-in users`.
- **Google/Apple sign-up:** the buttons show "not implemented yet" toasts.
- **Sign-in redirect after sign-up:** sign-up pushes to `/`, even though the callback is `/email-verified`.
- **Moderation:** Report/Block buttons are not wired. There is no admin area.
- **Search and filters:** browse only filters by city, from a fixed list in mock data. There is no search, device-type filter or pagination.
- **Tests:** none.

### Bugs and cleanup

- `models/request-specs.ts` is a duplicate of `models/requests.ts` (same export `requests`). It should hold request spec data.
- `models/*` mock files use a different shape from both the Prisma schema and `types/types.ts` (`MockListing`). Three parallel models of the same data will drift.
- `lib/auth-client.ts` hard-codes `baseURL: "http://localhost:3000"`, which will break in production. It should use an env var.
- `lib/auth-client.ts` imports `auth` from the server file for `inferAdditionalFields<typeof auth>()`. Use `import type` so server code isn't bundled into the client.
- `lib/auth.ts` has `secret` commented out and relies on the env var default. `trustedOrigins` includes a Vercel URL, but `README.md` says to set `BETTER_AUTH_URL`.
- Sign-in schema requires a password of at least 10 chars. It should only check non-empty. Accounts with older rules could be locked out.
- `LoginForm` swallows non-API errors, with only `console.error` and no user message.
- Post forms have no zod or react-hook-form, unlike the auth forms.
- `app/messages/[thread]/page.tsx` ignores `thread` and redirects to `/dashboard` after sign-in instead of the thread URL.
- Dashboard links all point to `/messages/1`.
- Both the new-listing and new-request pages accept any signed-in user, regardless of ID verification level. The `/verify` copy says verification is required first.
- `neon-db.ts` creates a new `PrismaClient` at module scope with no dev-time singleton. This can exhaust connections under hot reload.
- `Dockerfile` and `next.config.ts` are untouched defaults. The Docker build is untested.
- `public/` still contains Next.js template SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).

---

## File-by-file summary

### Config and root

| File | What it does |
|---|---|
| `package.json` | Next 16.2.4, React 19, better-auth, Prisma 7 (Neon + pg adapters), RHF + zod, Tailwind 4, Radix, sonner. |
| `next.config.ts` | Empty default config. |
| `prisma.config.ts` | Prisma CLI config. Reads `DATABASE_URL`. |
| `neon-db.ts` | Exports the shared `prisma` client using the Neon adapter. |
| `components.json` | shadcn config. |
| `Dockerfile` | Container build (untested). |
| `AGENTS.md` / `CLAUDE.md` | Warns that this Next.js has breaking changes. Read `node_modules/next/dist/docs/` first. |
| `README.md` | Setup, stack and structure. Parts are out of date (route groups `(main)`, `(dashboard)` and `(onboarding)` don't exist). |

### Backend (`actions/`, `lib/`, `models/`, `prisma/`, `validations/`, `types/`)

| File | What it does | Status |
|---|---|---|
| `actions/*.ts` (4 files) | Meant for server actions. | Empty |
| `lib/auth.ts` | better-auth server config: email and password, emailOTP plugin, Prisma adapter, extra user fields, trusted origins. | OTP sending is a stub |
| `lib/auth-client.ts` | Client exports `signIn`, `signUp`, `signOut` and `useSession`. | Hard-coded baseURL |
| `lib/get-session.ts` | `getServerSession()` helper using `next/headers`. | Done |
| `lib/utils.ts` | `cn()` class merge helper. | Done |
| `app/api/[auth]/[...all]/route.ts` | better-auth catch-all handler (GET, POST). | Done |
| `prisma/schema.prisma` | Full relational schema (see below). | Missing Offer, Message, Rating |
| `prisma/migrations/*` | `add_auth_models`, `role_update`. | Schema may have changed since. Run `prisma migrate dev` to check. |
| `validations/auth-validation.ts` | Zod `signUpSchema` and `signInSchema`. | Done |
| `types/types.ts` | UI types (`MockListing`, `MockRequest`, `ChatMessage`, `DeviceKind`). | Mock-shaped |
| `models/*.ts` | Seed-like mock arrays (10 users, listings, requests, specs, offers). Not imported by any page. | Mock only, one duplicate |
| `data/home-data.tsx` | Nav links, footer links, how-it-works steps, trust points. | Done |
| `data/marketplace-data.ts` | Mock `LISTINGS`, `REQUESTS`, `CITIES`, device kinds and conditions, and the mock chat thread. | Mock, drives all pages |
| `generated/prisma/*` | Generated Prisma client (checked into git). | Generated |

### Pages (`app/`)

| Route | What it does | Real or mock |
|---|---|---|
| `/` | Home: Hero, HowItWorks, Listings (first 3), TrustSection, CtaBanner. | Mock listings |
| `/sign-in` | `LoginForm`: RHF + zod, `signIn.email`, redirects to `callbackUrl`. | Real |
| `/sign-up` | `SignupForm`: names, email, password and confirm. Calls `signUp.email`. Google/Apple are stubs. | Real, no email sent |
| `/email-verified` | Static success page with a link to the dashboard. | Static |
| `/dashboard` | Auth-gated. Passes the first name to `DashboardView`. | Mock content |
| `/verify` | Auth-gated. `VerifyForm` (NIN, and ID plus selfie when `?level=2`). | UI only |
| `/listings` | `BrowsePage` (devices tab) with a city filter. | Mock |
| `/listings/[listing]` | Detail page, with `DetailLayout` and `ContactForm` ("request"). 404s on unknown id. | Mock |
| `/listings/new` | Sign-in gate, then `PostListingForm`. | Doesn't save |
| `/requests` | `BrowsePage` (requests tab). | Mock |
| `/requests/[request]` | Detail page, with `ContactForm` ("offer"). | Mock |
| `/requests/new` | Sign-in gate, then `PostRequestForm`. | Doesn't save |
| `/messages/[thread]` | Auth-gated. `ChatThread`. | Mock, ignores thread id |
| `app/layout.tsx` | Root layout: Montserrat and Raleway fonts, Header, Footer, Toaster. | Done |
| `app/(auth)/layout.tsx` | Passthrough with a TODO to redirect logged-in users. | TODO |
| `app/globals.css` | Tailwind 4 theme: brand colours (`pin-*`), type scale, badges and utilities. | Done |
| `app/icon.png`, `apple-icon.png`, `favicon.ico` | New brand icons (uncommitted). | Done |

### Components (`components/`)

| File | What it does |
|---|---|
| `layout/header.tsx` | Sticky dark header with logo, nav, session-aware auth buttons or `UserDropdown`, and a mobile menu. |
| `layout/footer.tsx` | Footer with links to `/privacy`, `/terms` and `/contact` (pages missing). |
| `layout/organic-edge.tsx` | Decorative wavy section divider. |
| `home/*` | Hero, how-it-works (and item), recent listings, trust section, CTA banner. |
| `browse/browse-page.tsx` | Shared devices/requests browse UI with a city filter and a "create account" nudge for guests. |
| `listing-card.tsx`, `request-card.tsx`, `device-tile.tsx` | Cards and placeholder device tile. |
| `detail/detail-layout.tsx` | Shared detail layout: specs, person, rating, handoffs, safety note. |
| `detail/contact-form.tsx` | Note and pledge form. Shows a sign-up prompt for guests. Fake send. |
| `post/post-listing-form.tsx` | Donor form: kind, brand, condition, photo placeholders, extras, city and area. Fake publish. |
| `post/post-request-form.tsx` | Requester form: kind, condition, reason (280 chars), location, pledge. Fake publish. |
| `post/chip-picker.tsx` | Reusable single-select chips. |
| `dashboard/dashboard-view.tsx` | Giving/Asking tabs, stats, incoming requests, own listings and requests. All hard-coded. |
| `messages/chat-thread.tsx` | Chat UI: send message, "share my number", confirm handoff, 5-star rating. All local state. |
| `verify/verify-form.tsx` | NIN and ID verification UI (placeholder). |
| `auth/sign-in-required.tsx` | Reusable "sign in to continue" gate. |
| `user-dropdown.tsx` / `user-avatar.tsx` | Account menu (dashboard, profile, admin, sign out) and avatar with initials. |
| `custom/field-input.tsx` | Labelled input with error text and a password show/hide toggle. |
| `custom/brand-icons.tsx` | Google and Apple SVG icons. |
| `ui/*` | shadcn primitives: avatar, button, card, dropdown-menu, field, input, input-group, label, password, separator, sonner, textarea, navigation-link. |

### Data model (Prisma)

- `User` (role, ID verification status, names, phone, country) → many `Listing`, `Request`, `Session`, `Account`.
- `Listing` 1:1 `DeviceSpec` (actual specs).
- `Request` 1:1 `RequestSpec` (minimum specs).
- Shared `RequestOfferStatus`: ACTIVE, MATCHED, CLOSED, EXPIRED.
- **Missing models:** Offer, Thread/Message, Rating, Handoff, Report/Block, and ID verification submissions.

---

## Suggested order of work

1. Fix quick wins: `import type` in `auth-client`, baseURL env var, admin role casing, and delete or fix `models/request-specs.ts`.
2. Wire up an email provider and the OTP/verification email. Add forgot and reset password pages.
3. Add `Offer` (and `Rating`) to the schema. Write `actions/listings.ts` and `actions/requests.ts` with zod validation, and replace the mock data with Prisma queries.
4. Connect the post and contact forms to those actions, with photo upload.
5. Build the real dashboard from DB data. Add choose and decline actions in `actions/matchings.ts`.
6. Add `Thread` and `Message` models, then a realtime server in `apps/socket`. Persist the handoff confirmation and ratings.
7. Build real ID verification (NIN provider, document upload, admin review).
8. Add the missing pages (profile, admin, privacy, terms, contact), search and filters, and tests.
