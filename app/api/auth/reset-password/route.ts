import { NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = typeof body.token === 'string' ? body.token : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!token) return NextResponse.json({ error: 'Reset link is missing or expired' }, { status: 400 })
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const updated = await resetPasswordWithToken(token, password)
    if (!updated) {
      return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return routeError(error, 'Failed to reset password')
  }
}
