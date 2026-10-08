import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { deleteHarvest } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

export async function DELETE(_request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const deleted = await deleteHarvest(user.id, id)
    if (!deleted) return NextResponse.json({ error: 'Harvest not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeError(error, 'Failed to delete harvest')
  }
}
