import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''

    const user = await authenticateUser(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

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
    return routeError(error, 'Failed to sign in')
  }
}
