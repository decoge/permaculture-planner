import fs from 'fs'
import path from 'path'
import { getPool } from '@/lib/db/pool'

const LOCK_KEY = 84219001

let pending: Promise<void> | null = null

export function migrationsDir(): string {
  return path.join(process.cwd(), 'db', 'migrations')
}

export async function migrate(): Promise<void> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const dir = migrationsDir()
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()

    for (const file of files) {
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [file])
      if (existing.rowCount) continue

      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined)
    client.release()
  }
}

export function ensureMigrated(): Promise<void> {
  if (!pending) {
    pending = migrate().catch((error) => {
      pending = null
      throw error
    })
  }
  return pending
}
