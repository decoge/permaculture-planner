import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { updateUserProfile } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name : ''
    const updated = await updateUserProfile(user.id, name)
    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        is_admin: updated.isAdmin,
      },
    })
  } catch (error) {
    return routeError(error, 'Failed to update profile')
  }
}
