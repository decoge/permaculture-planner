import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { deleteUser } from '@/lib/db/users'
import { routeError } from '@/lib/api/route-error'

export async function DELETE() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await deleteUser(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return routeError(error, 'Failed to delete account')
  }
}
