import { NextResponse } from 'next/server'
import { createUser } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'
import { validateEmail, validatePassword } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name : typeof body.fullName === 'string' ? body.fullName : null

    const emailCheck = validateEmail(email)
    if (!emailCheck.success) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 })
    }
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.success) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
    }

    const user = await createUser({ email, password, name })
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.isAdmin,
        created_at: user.createdAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('users_email_key') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return routeError(error, 'Failed to create account')
  }
}
