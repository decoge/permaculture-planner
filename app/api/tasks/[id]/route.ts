import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { setTaskCompleted, updateTask } from '@/lib/db/tasks'
import { deleteTask, setTaskPattern } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

export async function PATCH(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()

    // Completing-only keeps the original cheap path; anything else (due-date
    // edit, pattern change) goes through updateTask, which also generates the
    // next occurrence for a recurring task being completed.
    const onlyCompleted =
      typeof body.completed === 'boolean' &&
      body.dueOn === undefined &&
      body.recurringPattern === undefined

    if (onlyCompleted) {
      const updated = await setTaskCompleted(user.id, id, body.completed)
      if (!updated) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    const result = await updateTask(user.id, id, {
      completed: typeof body.completed === 'boolean' ? body.completed : undefined,
      dueOn: typeof body.dueOn === 'string' ? body.dueOn : undefined,
    })
    if (!result.task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // A pattern change applies from now on; it happens after the update so the
    // next occurrence was generated from the pattern the task had when it was
    // completed.
    if (typeof body.recurringPattern === 'string' || body.recurringPattern === null) {
      await setTaskPattern(user.id, id, body.recurringPattern)
    }

    return NextResponse.json({ success: true, nextOccurrenceCreated: result.nextOccurrenceCreated })
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
