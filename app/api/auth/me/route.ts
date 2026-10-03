import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { routeError } from '@/lib/api/route-error'

export async function GET() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ user: null })
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
    return routeError(error, 'Failed to load session')
  }
}
