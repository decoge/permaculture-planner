import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { deleteGarden, getPlanDetail, updateGarden } from '@/lib/db/gardens'
import { routeError } from '@/lib/api/route-error'

async function idFrom(params: { id: string } | Promise<{ id: string }>) {
  const resolved = await params
  return resolved.id
}

export async function GET(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const plan = await getPlanDetail(user.id, await idFrom(context.params))
    if (!plan) return NextResponse.json({ error: 'Garden not found' }, { status: 404 })
    return NextResponse.json({ plan })
  } catch (error) {
    return routeError(error, 'Failed to load garden')
  }
}

export async function PUT(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const updated = await updateGarden(
      user.id,
      await idFrom(context.params),
      Array.isArray(body.beds) ? body.beds : [],
      body.metadata
    )
    if (!updated) return NextResponse.json({ error: 'Garden not found' }, { status: 404 })
    return NextResponse.json({ success: true, ...updated, gardenId: updated.planId })
  } catch (error) {
    return routeError(error, 'Failed to update garden')
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const deleted = await deleteGarden(user.id, await idFrom(context.params))
    if (!deleted) return NextResponse.json({ error: 'Garden not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeError(error, 'Failed to delete garden')
  }
}
