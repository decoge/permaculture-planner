import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { listTasks, syncGeneratedTasks } from '@/lib/db/tasks'
import { routeError } from '@/lib/api/route-error'

export async function GET(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const tasks = await listTasks(user.id, id)
    if (!tasks) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    return NextResponse.json({ tasks })
  } catch (error) {
    return routeError(error, 'Failed to load tasks')
  }
}

export async function POST(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const result = await syncGeneratedTasks(user.id, id, Array.isArray(body.tasks) ? body.tasks : [])
    if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return routeError(error, 'Failed to save tasks')
  }
}
