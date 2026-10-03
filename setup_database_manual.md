# Database setup

Apply the SQL in `db/migrations` with:

```bash
npm run db:migrate
```

The connection string is `DATABASE_URL` in `.env.local`. See `SETUP.md` for the local Postgres role and the session secret.
