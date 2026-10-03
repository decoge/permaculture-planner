import { createHash, randomBytes } from 'crypto'
import { query, queryOne } from '@/lib/db/pool'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { writeSession, clearSession, type SessionUser } from '@/lib/auth/session'

export interface UserRecord {
  id: string
  email: string
  name: string | null
  full_name: string | null
  is_admin: boolean
  token_version: number
  created_at: Date | string
}

interface UserAuthRow extends UserRecord {
  password_hash: string
}

function createdAtIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.is_admin,
    tokenVersion: user.token_version,
    createdAt: createdAtIso(user.created_at),
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    full_name: user.full_name,
    is_admin: user.is_admin,
    created_at: user.created_at,
  }
}

export async function createUser(input: {
  email: string
  password: string
  name?: string | null
}): Promise<SessionUser> {
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password)
  const name = input.name?.trim() || null
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

  const user = await queryOne<UserRecord>(
    `INSERT INTO users (email, password_hash, name, full_name, is_admin)
     VALUES ($1, $2, $3, $3, $4)
     RETURNING id, email, name, full_name, is_admin, token_version, created_at`,
    [email, passwordHash, name, Boolean(adminEmail && email === adminEmail)]
  )

  if (!user) throw new Error('Failed to create user')
  const sessionUser = toSessionUser(user)
  await writeSession(sessionUser)
  return sessionUser
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await queryOne<UserAuthRow>(
    `SELECT id, email, name, full_name, is_admin, token_version, created_at, password_hash
     FROM users
     WHERE email = $1`,
    [normalizeEmail(email)]
  )
  if (!user) return null

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return null

  const sessionUser = toSessionUser(user)
  await writeSession(sessionUser)
  return sessionUser
}

export async function updateUserProfile(userId: string, name: string): Promise<SessionUser | null> {
  const trimmed = name.trim()
  const user = await queryOne<UserRecord>(
    `UPDATE users
     SET name = $2, full_name = $2
     WHERE id = $1
     RETURNING id, email, name, full_name, is_admin, token_version, created_at`,
    [userId, trimmed || null]
  )
  if (!user) return null
  const sessionUser = toSessionUser(user)
  await writeSession(sessionUser)
  return sessionUser
}

export async function deleteUser(userId: string): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [userId])
  await clearSession()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createPasswordReset(email: string): Promise<string | null> {
  const user = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [normalizeEmail(email)]
  )
  if (!user) return null

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  await query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id])
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [user.id, tokenHash]
  )
  return token
}

export async function resetPasswordWithToken(token: string, password: string): Promise<boolean> {
  const tokenHash = hashToken(token)
  const row = await queryOne<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  )
  if (!row) return false

  const passwordHash = await hashPassword(password)
  await query(
    `UPDATE users
     SET password_hash = $2, token_version = token_version + 1
     WHERE id = $1`,
    [row.user_id, passwordHash]
  )
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id])
  return true
}
