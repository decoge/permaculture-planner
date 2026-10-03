import { queryOne } from '@/lib/db/pool'
import { readSession, type SessionUser } from '@/lib/auth/session'

interface UserRow {
  id: string
  email: string
  name: string | null
  is_admin: boolean
  token_version: number
}

export async function requireUser(): Promise<SessionUser | null> {
  const session = await readSession()
  if (!session) return null

  const row = await queryOne<UserRow>(
    `SELECT id, email, name, is_admin, token_version
     FROM users
     WHERE id = $1`,
    [session.sub]
  )

  if (!row || row.token_version !== session.tokenVersion) return null

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: row.is_admin,
    tokenVersion: row.token_version,
  }
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await requireUser()
  if (!user?.isAdmin) return null
  return user
}
