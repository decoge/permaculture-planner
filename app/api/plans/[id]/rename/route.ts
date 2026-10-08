import { query } from '@/lib/db/pool'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { routeError } from '@/lib/api/route-error'

const MAX_NAME_LENGTH = 200

/** Rename a plan. Ownership is enforced in the query itself. */
export async function PATCH(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LENGTH) : ''
    if (!name) {
      return NextResponse.json({ error: 'A non-empty name is required' }, { status: 400 })
    }

    const updated = await query<{ id: string }>(
      `UPDATE plans p
       SET name = $3
       FROM sites s
       WHERE p.id = $1 AND p.site_id = s.id AND s.user_id = $2
       RETURNING p.id`,
      [id, user.id, name]
    )
    if (updated.length === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, name })
  } catch (error) {
    return routeError(error, 'Failed to rename plan')
  }
}
