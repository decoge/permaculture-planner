import { query, queryOne } from '@/lib/db/pool'
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

export async function syncGeneratedTasks(userId: string, planId: string, tasks: TaskInput[]) {
  if (!(await userOwnsPlan(userId, planId))) return null

  const existing = await query<{ title: string; due_on: Date | string }>(
    'SELECT title, due_on FROM tasks WHERE plan_id = $1',
    [planId]
  )
  const keys = new Set(
    existing.map((task) => `${task.title}|${String(task.due_on).slice(0, 10)}`)
  )

  let created = 0
  for (const task of tasks) {
    const due = String(task.due_on).slice(0, 10)
    const key = `${task.title}|${due}`
    if (keys.has(key)) continue
    await query(
      `INSERT INTO tasks (plan_id, title, description, category, due_on, notes, completed)
       VALUES ($1, $2, $3, $4::task_category, $5, $6, false)`,
      [
        planId,
        task.title,
        task.description || null,
        taskCategory(task.category),
        due,
        task.notes || null,
      ]
    )
    keys.add(key)
    created += 1
  }

  return { tasksCreated: created }
}
