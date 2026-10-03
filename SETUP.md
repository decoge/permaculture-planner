# Setup

The planner stores accounts and gardens in Postgres.

## Prerequisites

- Node.js 20.9 or newer
- PostgreSQL 14 or newer

## Configure

```bash
npm install
cp .env.local.example .env.local
```

Set these in `.env.local`:

```bash
DATABASE_URL=postgres://planner:planner@localhost:5432/permaculture
SESSION_SECRET=replace-with-a-long-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create the database, then apply migrations:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and create an account with email and password.

`ADMIN_EMAIL` marks that address as an admin when the account is created. For an existing account, run `npm run db:make-admin -- you@example.com` and sign in again.

Password reset links are returned by the API in local development. In production they are written to the server log until an email service is configured.
