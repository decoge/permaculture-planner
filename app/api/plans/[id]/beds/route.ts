import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { syncPlanBeds } from '@/lib/db/gardens'
import { routeError } from '@/lib/api/route-error'

export async function PUT(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const updated = await syncPlanBeds(
      user.id,
      id,
      Array.isArray(body.beds) ? body.beds : [],
      body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      typeof body.planName === 'string' && body.planName.trim() ? body.planName.trim() : undefined
    )
    if (!updated) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    return NextResponse.json({ success: true, planId: id })
  } catch (error) {
    return routeError(error, 'Failed to save beds')
  }
}
