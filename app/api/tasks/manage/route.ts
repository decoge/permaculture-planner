import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createTask, deleteTask } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

/** Create one task on an owned plan. The plan page checklist consumes this. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const planId = typeof body.planId === 'string' ? body.planId : ''
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const created = await createTask(user.id, planId, {
      title: typeof body.title === 'string' ? body.title : '',
      dueOn: typeof body.dueOn === 'string' ? body.dueOn : '',
      category: typeof body.category === 'string' ? body.category : undefined,
      description: typeof body.description === 'string' ? body.description : null,
    })

    if (!created) {
      return NextResponse.json({ error: 'Plan not found or invalid task' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: created.id })
  } catch (error) {
    return routeError(error, 'Failed to create task')
  }
}
