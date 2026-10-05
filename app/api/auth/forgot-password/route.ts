import { NextResponse } from 'next/server'
import { createPasswordReset } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'
import { validateEmail } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const emailCheck = validateEmail(email)
    if (!emailCheck.success) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 })
    }

    const token = await createPasswordReset(email)
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const origin = request.headers.get('origin') || new URL(request.url).origin
    const resetUrl = token ? `${origin}/auth/reset-password?token=${encodeURIComponent(token)}` : null

    // There is no mail provider wired up, so the link cannot be sent and
    // returning it in the response is the only way the flow works today. That is
    // already development-only, but the *log line* was not: it ran in production
    // too, writing a live reset token to stdout on every request. Anything that
    // aggregates logs -- hosting platform, error tracker, ship-it-to-your-team
    // setup -- now holds working credentials.
    if (resetUrl && isDevelopment) {
      console.info(`Password reset link for ${email}: ${resetUrl}`)
    }

    return NextResponse.json({
      // Identical whether or not the account exists, so this cannot be used to
      // enumerate registered addresses.
      ok: true,
      message: 'If an account exists for that email, a reset link is ready.',
      ...(isDevelopment && resetUrl ? { resetUrl } : {}),
    })
  } catch (error) {
    return routeError(error, 'Failed to start password reset')
  }
}
