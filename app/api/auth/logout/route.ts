import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'
import { routeError } from '@/lib/api/route-error'

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return routeError(error, 'Failed to sign out')
  }
}
