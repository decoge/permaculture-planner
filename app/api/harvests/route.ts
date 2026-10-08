import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createHarvest } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const plantingId = typeof body.plantingId === 'string' ? body.plantingId : ''
    if (!plantingId) {
      return NextResponse.json({ error: 'plantingId is required' }, { status: 400 })
    }

    const created = await createHarvest(user.id, {
      plantingId,
      harvestedOn: typeof body.harvestedOn === 'string' ? body.harvestedOn : '',
      quantity: typeof body.quantity === 'number' ? body.quantity : null,
      unit: typeof body.unit === 'string' ? body.unit : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })

    // Null means the planting is not on a plan this user owns (or the date was
    // malformed); both are client errors, deliberately not distinguished so the
    // response cannot confirm which plan ids exist.
    if (!created) {
      return NextResponse.json({ error: 'Planting not found or invalid input' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: created.id })
  } catch (error) {
    return routeError(error, 'Failed to record harvest')
  }
}
