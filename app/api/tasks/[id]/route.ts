import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { updateTask } from '@/lib/db/tasks'
import { deleteTask, setTaskPattern } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'
import { readJsonBody } from '@/lib/api/request-body'

export async function PATCH(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.body as Record<string, unknown>

    // Every edit goes through updateTask, including a bare completion toggle:
    // setTaskCompleted used to handle that case and skipped the next-occurrence
    // generation, so completing a recurring task from the UI ended the series.
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
