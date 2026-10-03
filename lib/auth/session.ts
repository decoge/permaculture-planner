import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionMaxAgeSeconds,
  verifySessionToken,
  type SessionPayload,
} from '@/lib/auth/token'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  tokenVersion: number
  createdAt: string | null
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function writeSession(user: Omit<SessionUser, never>): Promise<void> {
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    tokenVersion: user.tokenVersion,
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, cookieOptions(sessionMaxAgeSeconds))
}

export async function clearSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
