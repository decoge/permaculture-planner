/**
 * @jest-environment node
 *
 * PATCH /api/tasks/[id]: the completion toggle a checkbox sends is only
 * `{ completed: true }`. It used to take a fast path through setTaskCompleted,
 * which skipped the next-occurrence generation that updateTask performs — so
 * completing a recurring task from the UI silently ended the series.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ id: 'user-1', email: 'a@example.com', name: null, isAdmin: false }),
}))

const updateTask = jest.fn<
  (
    userId: string,
    taskId: string,
    patch: { completed?: boolean; dueOn?: string }
  ) => Promise<{ task: boolean; nextOccurrenceCreated: boolean }>
>()

jest.mock('@/lib/db/tasks', () => ({
  updateTask: (userId: string, taskId: string, patch: { completed?: boolean; dueOn?: string }) =>
    updateTask(userId, taskId, patch),
}))

const setTaskPattern = jest.fn<(userId: string, taskId: string, pattern: string | null) => Promise<boolean>>()
const deleteTask = jest.fn<(userId: string, taskId: string) => Promise<boolean>>()

jest.mock('@/lib/db/recordings', () => ({
  setTaskPattern: (userId: string, taskId: string, pattern: string | null) =>
    setTaskPattern(userId, taskId, pattern),
  deleteTask: (userId: string, taskId: string) => deleteTask(userId, taskId),
}))

function patch(body: unknown) {
  return new Request('http://localhost:3000/api/tasks/task-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

const context = { params: { id: 'task-1' } }

describe('PATCH /api/tasks/[id]', () => {
  beforeEach(() => {
    updateTask.mockReset()
    setTaskPattern.mockReset()
    deleteTask.mockReset()
    updateTask.mockResolvedValue({ task: true, nextOccurrenceCreated: true })
    setTaskPattern.mockResolvedValue(true)
  })

  test('a bare completion toggle goes through updateTask so recurrence still runs', async () => {
    const { PATCH } = await import('@/app/api/tasks/[id]/route')

    const response = await PATCH(patch({ completed: true }) as never, context as never)

    expect(response.status).toBe(200)
    expect(updateTask).toHaveBeenCalledWith('user-1', 'task-1', { completed: true, dueOn: undefined })
    expect(await response.json()).toEqual({ success: true, nextOccurrenceCreated: true })
  })

  test('a due-date edit carries no completion value, so the timestamp is untouched', async () => {
    updateTask.mockResolvedValue({ task: true, nextOccurrenceCreated: false })
    const { PATCH } = await import('@/app/api/tasks/[id]/route')

    const response = await PATCH(patch({ dueOn: '2026-11-01' }) as never, context as never)

    expect(response.status).toBe(200)
    expect(updateTask).toHaveBeenCalledWith('user-1', 'task-1', { completed: undefined, dueOn: '2026-11-01' })
  })

  test('a missing task is a 404 and still no pattern write', async () => {
    updateTask.mockResolvedValue({ task: false, nextOccurrenceCreated: false })
    const { PATCH } = await import('@/app/api/tasks/[id]/route')

    const response = await PATCH(
      patch({ completed: true, recurringPattern: 'weekly' }) as never,
      context as never
    )

    expect(response.status).toBe(404)
    expect(setTaskPattern).not.toHaveBeenCalled()
  })
})
