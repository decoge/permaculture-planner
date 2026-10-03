import fs from 'fs'
import path from 'path'
import pg from 'pg'

const LOCK_KEY = 84219001

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })
const client = await pool.connect()

try {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const dir = path.join(process.cwd(), 'db', 'migrations')
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [file])
    if (existing.rowCount) {
      console.log(`skip ${file}`)
      continue
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`applied ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined)
  client.release()
  await pool.end()
}
