import { query, queryOne, withTransaction } from '@/lib/db/pool'
import { taskCategory } from '@/lib/db/ids'
import { userOwnsPlan } from '@/lib/db/gardens'

export interface TaskInput {
  title: string
  description?: string
  category: string
  due_on: string
  notes?: string
}

export async function listTasks(userId: string, planId: string) {
  if (!(await userOwnsPlan(userId, planId))) return null
  return query(
    `SELECT * FROM tasks
     WHERE plan_id = $1
     ORDER BY due_on ASC, created_at ASC`,
    [planId]
  )
}

export async function setTaskCompleted(userId: string, taskId: string, completed: boolean) {
  const task = await queryOne<{ id: string }>(
    `UPDATE tasks t
     SET completed = $3,
         completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END
     FROM plans p
     JOIN sites s ON s.id = p.site_id
     WHERE t.id = $1 AND t.plan_id = p.id AND s.user_id = $2
     RETURNING t.id`,
    [taskId, userId, completed]
  )
  return Boolean(task)
}

/**
 * Cap on tasks accepted from a client. The dedupe below makes each title+date
 * pair unique, but an unbounded array is still a free way to make the database
 * do arbitrarily many inserts on the caller's behalf.
 */
const MAX_TASKS_PER_SYNC = 200

export async function syncGeneratedTasks(userId: string, planId: string, tasks: TaskInput[]) {
  if (!(await userOwnsPlan(userId, planId))) return null

  const existing = await query<{ title: string; due_on: Date | string }>(
    'SELECT title, due_on FROM tasks WHERE plan_id = $1',
    [planId]
  )
  const keys = new Set(
    existing.map((task) => `${task.title}|${String(task.due_on).slice(0, 10)}`)
  )

  // Collect the new rows first, then insert them in one statement. The previous
  // version issued an INSERT per task outside any transaction, so a failure
  // halfway through left the plan with a partially generated task list -- and
  // the retries could not tell which half had landed.
  const toInsert: { title: string; description: string | null; category: string; due: string; notes: string | null }[] = []
  for (const task of tasks.slice(0, MAX_TASKS_PER_SYNC)) {
    const title = typeof task.title === 'string' ? task.title.trim() : ''
    if (!title) continue
    const due = String(task.due_on).slice(0, 10)
    const key = `${title}|${due}`
    if (keys.has(key)) continue
    keys.add(key)
    toInsert.push({
      title,
      description: task.description || null,
      category: taskCategory(task.category),
      due,
      notes: task.notes || null,
    })
  }

  if (toInsert.length === 0) return { tasksCreated: 0 }

  await withTransaction(async (client) => {
    // unnest keeps this a single round trip regardless of row count, and the
    // enum casts happen once here rather than being interpolated per row.
    await client.query(
      `INSERT INTO tasks (plan_id, title, description, category, due_on, notes, completed)
       SELECT $1, t.title, t.description, t.category::task_category, t.due::date, t.notes, false
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
            AS t(title, description, category, due, notes)`,
      [
        planId,
        toInsert.map((row) => row.title),
        toInsert.map((row) => row.description),
        toInsert.map((row) => row.category),
        toInsert.map((row) => row.due),
        toInsert.map((row) => row.notes),
      ]
    )
  })

  return { tasksCreated: toInsert.length }
}
