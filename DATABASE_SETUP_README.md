# Database setup

The app uses Postgres through `DATABASE_URL`. Schema lives in `db/migrations`.

```bash
createdb permaculture
# or: createuser planner && createdb -O planner permaculture

npm run db:migrate
```

`npm run db:migrate` applies every SQL file in `db/migrations` that has not been recorded in `schema_migrations`. The server also applies pending migrations on the first query.

Accounts, sites, plans, beds, plantings, and tasks are all in this database. There is no hosted Supabase project.
