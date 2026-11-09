# Nyeaka

Nyeaka connects device **donors** with **requesters** who need laptops, tablets, smartphones, or desktops. Donors list devices; requesters post what they need; the platform matches them.

Built in-house by Joshua Oke for Paradigm Initiative.

## Tech Stack

- **Next.js 16** (App Router) + React 19 — note: v16 has breaking changes vs older Next.js; check `node_modules/next/dist/docs/` before assuming familiar APIs
- **TypeScript**
- **Prisma 7** (`prisma-client` generator, output at `generated/prisma`) on **PostgreSQL** (Neon)
- **better-auth** — email/password + email OTP, Prisma adapter
- **Tailwind CSS 4**
- **Radix UI** / shadcn-style components (`components.json`)
- **React Hook Form** + **Zod** for form validation
- **pnpm** workspaces (this app lives at `apps/web`; see also `apps/socket`)

## Project Structure

```text
app/
  (auth)/        sign-in, sign-up, forgot-password, reset-password
  (main)/        public site — home, listings, requests
  (dashboard)/   authenticated dashboard (in progress)
  (onboarding)/  onboarding flow (in progress)
  api/[auth]/    better-auth catch-all route handler
actions/         server actions (auth, listings, matchings, requests)
components/      UI components (ui/, layout/, home/, custom/)
lib/             auth.ts, auth-client.ts, get-session.ts, utils.ts
models/          domain types (listings, requests, offers, device specs, users)
validations/     Zod schemas
prisma/          schema.prisma + migrations
neon-db.ts       Prisma client instance (Neon adapter)
```

## Data Model

Core Prisma models (`prisma/schema.prisma`):

- **User** — role is one of `REQUESTER`, `DONOR`, `BOTH`, `GUEST`, `ADMIN`; tracks ID verification status
- **Listing** + **DeviceSpec** — a donor's device and its actual specs
- **Request** + **RequestSpec** — a requester's need and their minimum acceptable specs
- **Session** / **Account** / **Verification** — better-auth tables

Requests and listings share a `RequestOfferStatus` (`ACTIVE`, `MATCHED`, `CLOSED`, `EXPIRED`) and an `expiresAt`, so matching logic can treat both sides symmetrically.

## Getting Started

### Prerequisites

- Node.js, pnpm
- A PostgreSQL database (project targets Neon)

### Environment Variables

Create `.env` with:

```env
DATABASE_URL=
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_BETTER_AUTH_URL=
```

### Install & Run

```bash
pnpm install
pnpm dlx prisma generate   # generates client into generated/prisma
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other Scripts

```bash
pnpm build   # production build
pnpm start   # run production build
pnpm lint    # eslint
```

### Database

```bash
pnpm dlx prisma migrate dev     # apply/create migrations
pnpm dlx prisma studio          # inspect data
```

## Auth

Handled by `better-auth` (`lib/auth.ts`), backed by Prisma/Postgres. Supports email/password sign-in and email OTP (sign-in, email verification, password reset — OTP delivery is currently a stub in `sendVerificationOTP` and needs an email provider wired in). All auth routes are served through the single catch-all handler at `app/api/[auth]/[...all]/route.ts`.

## Deployment

Configured for Vercel (`https://nyeaka-v1.vercel.app` is a trusted origin in `lib/auth.ts`). A `Dockerfile` is also present for containerized deploys.
