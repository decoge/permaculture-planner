# Production requirements

The running app uses Postgres and email/password sessions. It does not call Supabase.

## Required environment

```bash
DATABASE_URL=postgres://user:password@host:5432/permaculture
SESSION_SECRET=replace-with-a-long-random-string
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

`SESSION_SECRET` signs the `pp_session` cookie. `npm run db:migrate` must run against the production database before the first request, or the server applies pending migrations on first query.

## Accounts

- Signup creates the user and signs them in. There is no email confirmation step.
- Password reset stores a one-hour token. Production currently logs the reset URL on the server. Wire an email provider before relying on that flow for users.
- Set `ADMIN_EMAIL` before that person signs up, or run `npm run db:make-admin -- you@example.com` and have them sign in again.

## Runtime

- Node.js 20.9 or newer
- `npm run build` then `npm start`
- Rate limits for sign-in, signup, and password reset live in `proxy.ts`. Sign-out is not counted against the auth limit.
