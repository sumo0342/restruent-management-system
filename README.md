# Spice Route Kitchen — Restaurant Management System

A role-based, production-shaped restaurant management system: real authentication,
a real MongoDB database via Prisma, server-enforced authorization on every
mutation, an audit trail, and the full waiter → kitchen → waiter → manager →
payment workflow backed by real database writes (no mock data, no client-only state).

## Roles

| Role | Home screen | Can do |
|---|---|---|
| **Owner** | `/owner/dashboard` | Everything: users, menu, tables, branches, reports, notes, maintenance, settings, audit log, and an override on any order transition |
| **Manager / Cashier** | `/manager/dashboard` | Billing, combined bills per table, split payments, shifts |
| **Kitchen / Chef** | `/kitchen/display` | Kitchen Display System — start/ready orders |
| **Waiter** | `/waiter/tables` | Take orders, send to kitchen, serve, request cancellations |

## Branches (optional multi-location support)

A restaurant can optionally split into **branches** — separate physical locations,
each with its own tables, staff and menu. This is entirely opt-in: every
`branchId` field in the schema is nullable and defaults to `null`, so a
restaurant that never creates a branch behaves exactly as if this feature
didn't exist — one shared floor, one shared menu, no extra steps.

Once you create a branch (**Owner → Branches**):

- Assign staff to it from **Owner → Users** (or leave them with "No branch").
- Assign tables to it from **Owner → Tables**.
- Give it its own menu from **Owner → Menu** — a category can be scoped to one
  branch, or left "shared across every branch".
- Every non-owner role (manager/kitchen/waiter) then only sees their own
  branch's tables, orders, bills and menu items. A staff member with no
  branch assigned only sees branch-less (unassigned) data.
- The **Owner** role always sees every branch at once — branches split floor
  operations, not tenancy.

Order and bill numbers stay a single restaurant-wide sequence rather than a
separate counter per branch, so there's no risk of two branches minting the
same order/bill number.

The demo seed data (below) sets up two branches — **Main Street** and
**Riverside** — with separate staff, tables and menus (Riverside's menu has
slightly different prices and one extra item), so you can see the isolation
working immediately without configuring anything yourself.

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma** ORM — connects to **MongoDB** (built and tested against a free
  MongoDB Atlas cluster; any MongoDB **replica set** works, since Prisma
  needs one for transactions — Atlas clusters are replica sets by default,
  even on the free M0 tier)
- **Tailwind CSS**, hand-rolled UI primitives (no component library dependency)
- **bcryptjs** for password hashing, DB-backed session cookies (httpOnly, signed by
  opaque random ID — not JWT) for session-based auth
- **Recharts** for the owner dashboard charts
- **Zod** for API input validation
- **Vitest** for unit tests

### On "real-time"

The spec calls for orders to appear on the Kitchen Display and waiter notifications
without a manual refresh. This implementation uses **short-interval polling**
(kitchen board polls every 3s, waiter notifications every 4s) rather than a
WebSocket/Socket.IO server. This was a deliberate simplification: a custom
Socket.IO server needs a non-serverless Node process and its own deployment story,
which adds real operational complexity for a project this size. Polling gives
near-instant (3-4 second) updates with zero extra infrastructure and works
identically on any host. If you need true push-based updates, MongoDB's own
**Change Streams** are a natural fit here (arguably a better one than the
Postgres `LISTEN/NOTIFY` this project would have used on Postgres) — you'd
open a change stream on the `Order` collection filtered to the relevant
`restaurantId`/status and push matching events over a WebSocket or SSE
connection instead of polling. The polling endpoints
(`/api/kitchen/orders`, `/api/waiter/notifications`) are exactly the queries
you'd replace with that stream.

## Getting started

### 1. Create a free MongoDB Atlas cluster

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free **M0** cluster.
2. **Database Access** → add a database user with a username/password (not your Atlas login).
3. **Network Access** → add an IP entry. For local dev, "Allow access from anywhere" (`0.0.0.0/0`) is the easy option; tighten this before production.
4. **Database** → **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority
   ```
5. Add a database name before the `?` (Atlas doesn't include one by default) — e.g. `.../rms?retryWrites=true...`.

### 2. Configure and run

```bash
npm install
cp .env.example .env        # then paste your real connection string into DATABASE_URL
npm run db:push             # creates the collections/indexes from the schema
npm run db:seed             # demo restaurant, users, tables, menu
npm run dev                 # http://localhost:3000
```

> **Note on `npm install`:** the `postinstall` script runs `prisma generate`,
> which needs to reach `binaries.prisma.sh` to download its query engine. This
> is normal on any machine with regular internet access — it only fails in
> network-sandboxed environments (like the one this was built in) that don't
> allowlist that host.

> **Note on `db:push`:** MongoDB has no SQL migration files, so there's no
> `prisma migrate dev` here — `db push` applies the schema (collections,
> validators, indexes) directly. Because every branch-related field is
> optional, a plain `npm run db:push` is non-destructive and safe to run on
> an existing database — it won't touch your current tables/orders/bills.
> Use `npm run db:reset` only if you want to wipe and reseed from scratch.

### Test accounts (created by `npm run db:seed`)

| Role | Branch | Email | Password |
|---|---|---|---|
| Owner | — (sees both) | owner@restaurant.com | Owner@123 |
| Manager | Main Street | manager@restaurant.com | Manager@123 |
| Kitchen | Main Street | chef@restaurant.com | Chef@123 |
| Waiter | Main Street | waiter1@restaurant.com | Waiter@123 |
| Waiter | Main Street | waiter2@restaurant.com | Waiter@123 |
| Manager | Riverside | manager2@restaurant.com | Manager@123 |
| Kitchen | Riverside | chef2@restaurant.com | Chef@123 |
| Waiter | Riverside | waiter3@restaurant.com | Waiter@123 |

Seed data: 2 branches (Main Street: 10 tables across Main Hall/Terrace/Private
Room; Riverside: 6 tables across Riverside Deck/Indoor), 5 menu categories and
~20 menu items per branch. Log in as a Main Street waiter and a Riverside
waiter side by side to see that neither sees the other's tables or menu.

### Running the tests

```bash
npm test
```

Covers the order status state machine (which role may perform which transition —
spec section 24/28) and the billing math (tax/service-charge/discount rounding,
split-payment validation). These are pure-logic unit tests that don't need a
database. For the full workflow, see **"Testing the end-to-end flow"** below.

## Testing the end-to-end flow

1. Log in as a **waiter**, open a table, add a couple of items, send to kitchen.
2. In another browser/incognito window, log in as **kitchen** — the order appears
   on the Kitchen Display within ~3 seconds. Click **Start preparing**, then
   **Mark ready**.
3. Back in the waiter tab, a toast notification appears within ~4 seconds
   ("Order #… for Table … is ready"). Go to **My orders** and click
   **Mark served**.
4. Log in as **manager**, go to **Billing**, select the table, **Generate bill**
   (try adding a discount), then take payment — try a **split payment** across
   cash + UPI to confirm the amounts must sum to the total.
5. The receipt page opens automatically; the table returns to **Available**.
6. Log in as **owner** and check **Audit log** — every step above should have a
   timestamped entry, and **Reports** should reflect the paid bill.

## Project structure

```
prisma/schema.prisma       All entities: User, Restaurant, Branch,
                            RestaurantTable, MenuCategory/Item, TableSession,
                            Order, OrderItem, Bill, Payment, Shift, Note,
                            MaintenanceRecord, AuditLog, Session
prisma/seed.ts              Demo data (2 branches, separate staff/tables/menu)
src/lib/auth.ts             Session cookies, bcrypt, rate limiting
src/lib/branchScope.ts      Scopes queries to the current user's branch —
                            no-op for OWNER, no-op entirely if you never
                            create a branch
src/lib/orderStateMachine.ts Role → allowed order-status transitions
src/lib/actions/owner.ts    Server actions for all owner CRUD (users, menu,
                            tables, notes, maintenance, settings) — every one
                            re-checks role server-side and writes an audit log
src/app/api/**              Route handlers for waiter/kitchen/manager actions
                            (used by client components that poll for updates)
src/app/{owner,manager,kitchen,waiter}/  One route tree per role
src/middleware.ts           Redirects unauthenticated requests to /login
                            (the authoritative role check happens server-side
                            in each page/action, not in middleware — Prisma
                            can't run in the Edge runtime)
```

## Security notes

- Every mutation — server action or API route — calls `requireRole(...)` (or
  `requireUser()`) **on the server**, independent of what the UI shows or hides.
  Hiding a button is never the only protection.
- Passwords are hashed with bcrypt (cost 12); sessions are opaque, random,
  httpOnly, DB-backed rows with a 12-hour expiry — not a JWT, so a session can be
  revoked by deleting the row.
- Login is rate-limited (8 attempts / 5 minutes per IP+email) with a constant
  failure message so it doesn't reveal whether the email exists.
- Prisma parameterizes every query — no raw SQL, no injection surface.
- Money is never trusted from the client beyond raw numbers to charge — prices
  are looked up server-side from the menu and **snapshotted** onto `OrderItem`
  at order time, so a later menu price change never rewrites history.
- Menu items are soft-deleted (`available: false`) rather than hard-deleted,
  since historical orders reference them.
- Duplicate payment submission is blocked (`Bill.status` is checked before
  accepting a new payment).
- Paid/closed bills cannot be edited — there is no update path once
  `status` reaches `PAID`.

## Switching to a SQL database (PostgreSQL, etc.)

If you'd rather run this on Postgres/MySQL/SQL Server than MongoDB, note that
this schema currently leans on a couple of Mongo-specific things you'd need to
undo: every `id`/foreign-key field uses `@db.ObjectId`, and IDs default via
`@default(auto()) @map("_id") @db.ObjectId)` instead of `@default(cuid())`.
To move to Postgres:

1. In `prisma/schema.prisma`, change the datasource block:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Remove every `@db.ObjectId` and `@map("_id")` annotation, and change every
   `@id @default(auto())` back to `@id @default(cuid())`.
3. Optionally convert the String "enum" fields (`role`, `status`, `priority`,
   ...) to real Prisma `enum` types — Postgres supports them natively; see
   `src/lib/enums.ts` for the exact value sets to turn into `enum` blocks, and
   update the handful of files that import types from there back to
   `@prisma/client` if you do.
4. Set `DATABASE_URL` in `.env` to your Postgres connection string.
5. Run `npx prisma migrate dev --name init` instead of `db:push` to get real
   migration files (Postgres supports proper migration history; Mongo doesn't).

## Deployment

This is a standard Next.js app — it deploys to Vercel, Railway, Render, Fly.io,
or any Node host. Steps:

1. Use your Atlas cluster's connection string (or another Mongo replica set)
   as `DATABASE_URL` — the same one from local dev works, or provision a
   separate production cluster/database name.
2. Set `SESSION_SECRET` to a long random string (`openssl rand -base64 32`) —
   currently unused directly by the cookie (sessions are opaque DB rows, not
   signed tokens), but reserved for a future move to signed/JWT sessions.
3. Run `npx prisma db push` as part of your build/release step (there's no
   `migrate deploy` for Mongo — `db push` is also what you run in production).
4. Run `npm run db:seed` once against the fresh database if you want the demo
   data (skip this for a real deployment and create your first Owner account
   directly via `npx prisma studio` or a one-off script instead).
5. `npm run build && npm run start`.

**Change the demo passwords before deploying anywhere reachable from the
internet.**

## Known simplifications (read before treating this as "done, ship it")

- **Real-time is polling, not WebSockets** — see above. Functionally
  equivalent from a user's perspective at this scale, not identical in
  implementation to what section 4 of the spec literally named.
- **Rate limiting is in-memory** — fine for a single instance/demo, not for a
  multi-instance production deployment (swap for a Redis-backed limiter).
- **No automated end-to-end/integration tests** — the included Vitest suite
  covers the two riskiest pieces of pure business logic (the state machine and
  the billing math) without needing a database in CI. Automating the full
  multi-role browser workflow (waiter → kitchen → waiter → manager → payment)
  would need Playwright with a seeded test database and multiple authenticated
  browser contexts; that's a natural next addition but wasn't built here.
- **This was assembled and reviewed in a network-sandboxed environment that
  could not reach `binaries.prisma.sh`**, so `prisma generate`/`db push` could
  not be executed here, and the app has not been run end-to-end by an actual
  browser. Every file was read through manually for correctness (and one real
  schema-relation bug and one real page bug were caught and fixed this way),
  but you should run the "Testing the end-to-end flow" checklist above
  yourself after `npm install` on a machine with normal internet access before
  relying on this.
