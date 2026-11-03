import { NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'
import { readJsonBody } from '@/lib/api/request-body'
import { validatePassword } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.body as Record<string, unknown>
    const token = typeof body.token === 'string' ? body.token : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!token) return NextResponse.json({ error: 'Reset link is missing or expired' }, { status: 400 })
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.success) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
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
