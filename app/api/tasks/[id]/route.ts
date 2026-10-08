import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { setTaskCompleted } from '@/lib/db/tasks'
import { deleteTask } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

export async function PATCH(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const updated = await setTaskCompleted(user.id, id, Boolean(body.completed))
    if (!updated) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeError(error, 'Failed to update task')
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const deleted = await deleteTask(user.id, id)
    if (!deleted) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeError(error, 'Failed to delete task')
  }
}
