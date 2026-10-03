import { NextResponse } from 'next/server'
import { createPasswordReset } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const token = await createPasswordReset(email)
    const origin = request.headers.get('origin') || new URL(request.url).origin
    const resetUrl = token ? `${origin}/auth/reset-password?token=${encodeURIComponent(token)}` : null

    if (resetUrl) {
      console.info(`Password reset link for ${email}: ${resetUrl}`)
    }

    return NextResponse.json({
      ok: true,
      message: 'If an account exists for that email, a reset link is ready.',
      ...(process.env.NODE_ENV !== 'production' && resetUrl ? { resetUrl } : {}),
    })
  } catch (error) {
    return routeError(error, 'Failed to start password reset')
  }
}
