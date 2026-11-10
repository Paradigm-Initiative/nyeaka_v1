# Nyeaka

Nyeaka connects device **donors** with **requesters** who need laptops, tablets, smartphones or desktops. Donors list devices, requesters post what they need, and either side can send an offer. When one is accepted the two get a private chat, agree a public place to meet, and confirm the handoff.

Built in-house by Joshua Oke for Paradigm Initiative. For what is built, what is not, and what to do before launch, read [README-STATUS.md](README-STATUS.md).

## Tech stack

- **Next.js 16** (App Router) + React 19. This version has breaking changes from older Next.js; check `node_modules/next/dist/docs/` before assuming a familiar API (see [AGENTS.md](AGENTS.md)).
- **TypeScript**, **Tailwind CSS 4**, Radix/shadcn-style components, React Hook Form + Zod.
- **Prisma 7** (`prisma-client` generator, output in `generated/prisma`) on **PostgreSQL** (Neon in production).
- **better-auth**: email and password, with an email verification step.
- **SendByte** for email, **Cloudflare R2** (S3-compatible) for listing photos.
- **Vitest** with an in-process Postgres (PGlite) for tests.
- **pnpm**. This app lives at `apps/web` (`apps/socket` is an unused stub).

## How it works

1. A donor lists a device; a requester posts a request. Posts last 60 days and can be edited, closed and renewed.
2. Either side sends an **offer** linking one listing to one request, from the detail pages. A donor can have one pending offer per request.
3. The other side **accepts or declines** it. Accepting runs in one transaction: it creates the match and its chat, marks both posts matched, and declines every other pending offer on that device or request. Everyone affected is emailed.
4. Matched people **chat** (the open page refreshes every 10 seconds). Phone numbers are shown only when **both** opt in.
5. Both **confirm the handoff**. Both can then **rate** each other. A cancelled match can be rated only if both people exchanged messages. Cancelling puts both posts back to live.
6. **Safety:** people can report or block someone they have been matched with. See the rules in [README-STATUS.md](README-STATUS.md#rules-in-force).

## Project structure

```text
app/                  routes: home, listings, requests, dashboard, messages/[thread], auth, api
actions/              server actions (thin: check the session, call lib/, revalidate, send emails)
lib/                  the logic. offers, matches, messages, handoff, ratings, safety,
                      rate-limit, queries, offer-emails, email, notify, storage ...
components/           ui/ (shadcn), detail/, dashboard/, messages/, safety/, offers/, post/ ...
validations/          Zod schemas shared by actions and services
prisma/               schema.prisma, migrations/, seed.ts
tests/                Vitest suites; tests/helpers/ has the in-memory database
neon-db.ts            the Prisma client (Neon driver; the pg driver for localhost URLs)
```

Business rules live in `lib/`, not in actions or components, so every entry point is covered by the same checks and the same tests.

## Data model

Main models in `prisma/schema.prisma`:

- **User**: role, ID-verification fields, optional `phone`, and `restrictedAt` / `restrictedReason` (set automatically, see status file).
- **Listing** + **DeviceSpec**, **Request** + **RequestSpec**: each has `status` (`ACTIVE`, `MATCHED`, `CLOSED`, `EXPIRED`) and `expiresAt`. A post past `expiresAt` counts as expired even if its status still says `ACTIVE`; nothing flips it in the background.
- **Offer**: links a listing and a request, with `donorId` and `initiatedById` (who sent it). A partial unique index allows one `PENDING` offer per donor and request.
- **Match** → **Conversation** → **Message**: created together when an offer is accepted. The match holds the phone-share opt-ins, both handoff confirmations, and who cancelled and when.
- **Rating**, **Report** (with `reportedUserId`), **Block**.
- **Session** / **Account** / **Verification**: better-auth tables.

## Getting started

### Prerequisites

Node.js, pnpm, and a PostgreSQL database (the project targets Neon).

### Environment variables

Create `.env`. Names only here; never commit values.

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Required. Postgres connection string. |
| `BETTER_AUTH_SECRET` | Required. Signs sessions. |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` | Required. The public site address. **Email links are built from it**, so in production it must be the real address, or links point at localhost. |
| `SENDBYTE_KEY` | Required to send email (must look like `sk_test_…` or `sk_live_…`). |
| `EMAIL_FROM` | Optional. Defaults to `Nyeaka <no-reply@nyeaka.org>`. |
| `ADMIN_EMAIL` | Where reports and restriction notices go. If unset, reports are still saved, a warning is logged, and nobody is emailed. Also quoted to restricted users as the contact address. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | Listing photo uploads (R2). |
| `ALLOW_SEED` | Set to `true` only to run the seed script. |

### Install and run

```bash
pnpm install               # also generates the Prisma client
pnpm exec prisma migrate deploy   # apply migrations to DATABASE_URL
pnpm dev
```

Open <http://localhost:3000>. In development use `pnpm exec prisma migrate dev` to create new migrations.

### Scripts

```bash
pnpm dev      # dev server
pnpm build    # production build
pnpm start    # run the production build
pnpm lint     # eslint
pnpm test     # vitest (see Testing)
pnpm exec tsc --noEmit    # typecheck
```

### Seed data

```bash
ALLOW_SEED=true pnpm exec prisma db seed
```

Creates a few fixed-id demo users (`@seed.nyeaka.test`, no passwords) with posts, an accepted offer, a chat, a rating, a block and a report. It refuses to run in production.

## Testing

```bash
pnpm test
```

The suites in `tests/` need no database or network. `tests/helpers/test-db.ts` starts an in-memory Postgres (PGlite), applies **every real migration** to it, and points Prisma at it. Email is mocked. They cover offers, accept/decline/cancel, chat, rate limits, block/report/restriction, phone sharing, handoff, ratings and the emails. Prisma's Neon driver is not exercised (PGlite is a single session, so two truly parallel transactions can't be simulated either).

### Trying the app in a browser without touching Neon

```bash
pnpm exec tsx tests/helpers/dev-db.ts          # in-memory database with verified demo users, kept alive
# in another terminal:
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5544/postgres?sslmode=disable' \
BETTER_AUTH_SECRET=dev-secret BETTER_AUTH_URL=http://localhost:3000 \
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000 \
SENDBYTE_KEY=sk_test_fake_never_delivers ADMIN_EMAIL=admin@example.test \
pnpm dev
```

Sign in as `alice`, `bob`, `carol` or `dave` (`<name>@dev.nyeaka.test`, password `Passw0rd!x1`). Alice and Dave have listings; Bob, Carol and Dave have requests. The fake mail key means every email fails to send (and is logged) instead of being delivered. Everything is lost when the database process stops.

## Operations

- **A user was restricted.** Review their reports (the admin email lists them). To lift it, clear `restrictedAt` and `restrictedReason` on the user, after setting any unfounded reports to `DISMISSED` (dismissed reports no longer count, so the next report or block won't restrict them again straight away). There is no admin page yet.
- **Reports and their status** are managed in the database only; the app never changes a report's status.

## Deployment

Configured for Vercel (`https://nyeaka-v1.vercel.app` and `https://nyeaka.paradigmhq.org` are trusted origins in `lib/auth.ts`). A `Dockerfile` and `output: "standalone"` are present, but the Docker build has not been tested. Email is sent after the response using Next's `after()`.
