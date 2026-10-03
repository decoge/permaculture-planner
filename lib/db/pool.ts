import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'
import { ensureMigrated } from '@/lib/db/migrate'

const NUMERIC_OID = 1700

let pool: Pool | null = null
let typesConfigured = false

function configureTypes() {
  if (typesConfigured) return
  types.setTypeParser(NUMERIC_OID, (value) => (value === null ? null : Number(value)))
  typesConfigured = true
}

export function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local.')
  }
  return connectionString
}

export function getPool(): Pool {
  if (!pool) {
    configureTypes()
    pool = new Pool({ connectionString: getDatabaseUrl() })
  }
  return pool
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureMigrated()
  const result = await getPool().query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export type { PoolClient }
