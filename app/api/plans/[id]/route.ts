import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { deleteGarden, getPlanDetail } from '@/lib/db/gardens'
import { routeError } from '@/lib/api/route-error'

async function idFrom(params: { id: string } | Promise<{ id: string }>) {
  return (await params).id
}

export async function GET(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const plan = await getPlanDetail(user.id, await idFrom(context.params))
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    return NextResponse.json(plan)
  } catch (error) {
    return routeError(error, 'Failed to load plan')
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const deleted = await deleteGarden(user.id, await idFrom(context.params))
    if (!deleted) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeError(error, 'Failed to delete plan')
  }
}
