/**
 * @jest-environment node
 *
 * updateTask: due-date editing and the recurring-task completion flow, where
 * completing the task must generate exactly one next occurrence with the due
 * date advanced by the pattern's interval.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

type QueryRow = Record<string, unknown>
const clientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: QueryRow[] }>>()

jest.mock('@/lib/db/pool', () => ({
  query: async () => [],
  queryOne: async () => null,
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => clientQuery(sql, params) }),
}))

// tasks.ts imports lib/db/ids, which pulls ESM-only uuid -- the documented Jest
// trap; mock the whole module since these tests never exercise it.
jest.mock('@/lib/db/ids', () => ({
  taskCategory: (value: unknown) => (typeof value === 'string' ? value : 'maint'),
}))

// userOwnsPlan comes from lib/db/gardens, which also imports lib/db/pool (mocked
// above) and lib/db/ids -- mock the module wholesale.
jest.mock('@/lib/db/gardens', () => ({
  userOwnsPlan: async () => true,
}))

const TASK_ROW = {
  id: 'task-1',
  recurring_pattern: 'weekly',
  due_on: '2026-10-08',
}

let updateTask: typeof import('@/lib/db/tasks')['updateTask']

beforeEach(async () => {
  clientQuery.mockReset()
  // Default: the UPDATE finds and returns the task; the pattern lookup returns it too.
  clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('UPDATE tasks')) return Promise.resolve({ rowCount: 1, rows: [TASK_ROW] })
    if (sql.includes('SELECT plan_id')) {
      return Promise.resolve({
        rowCount: 1,
        rows: [{ plan_id: 'plan-1', title: 'Water', description: null, category: 'water', due_on: '2026-10-08' }],
      })
    }
    return Promise.resolve({ rowCount: 0, rows: [] })
  })
  const tasks = await import('@/lib/db/tasks')
  updateTask = tasks.updateTask
})

describe('updateTask due-date editing', () => {
  test('writes the new due date', async () => {
    const result = await updateTask('user-1', 'task-1', { dueOn: '2026-10-15' })

    expect(result).toEqual({ task: true, nextOccurrenceCreated: false })
    const update = clientQuery.mock.calls.find((call) => (call[0] as string).includes('UPDATE tasks'))
    const params = update![1] as unknown[]
    // completed null (unchanged), dueOn set
    expect(params[2]).toBeNull()
    expect(params[3]).toBe('2026-10-15')
  })

  test('rejects a malformed date without touching the database', async () => {
    const result = await updateTask('user-1', 'task-1', { dueOn: 'not-a-date' })
    expect(result).toEqual({ task: false, nextOccurrenceCreated: false })
    expect(clientQuery).not.toHaveBeenCalled()
  })

  test('an empty patch is a no-op', async () => {
    const result = await updateTask('user-1', 'task-1', {})
    expect(result).toEqual({ task: false, nextOccurrenceCreated: false })
    expect(clientQuery).not.toHaveBeenCalled()
  })

  test('an unknown task id returns task: false', async () => {
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('UPDATE tasks')) return Promise.resolve({ rowCount: 0, rows: [] })
      return Promise.resolve({ rowCount: 0, rows: [] })
    })
    const result = await updateTask('user-1', 'missing', { dueOn: '2026-10-15' })
    expect(result.task).toBe(false)
  })
})

describe('updateTask recurrence', () => {
  test('completing a weekly task creates the next occurrence 7 days out', async () => {
    const result = await updateTask('user-1', 'task-1', { completed: true })

    expect(result).toEqual({ task: true, nextOccurrenceCreated: true })
    const insert = clientQuery.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    expect(insert).toBeDefined()
    const params = insert![1] as unknown[]
    // plan_id, title, description, category, next due (2026-10-08 + 7), pattern
    expect(params[0]).toBe('plan-1')
    expect(params[4]).toBe('2026-10-15')
    expect(params[5]).toBe('weekly')
  })

  test('monthly advances by 30 days; unknown patterns generate nothing', async () => {
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('UPDATE tasks')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: 'task-1', recurring_pattern: 'monthly', due_on: '2026-10-08' }] })
      }
      if (sql.includes('SELECT plan_id')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ plan_id: 'plan-1', title: 'Water', description: null, category: 'water', due_on: '2026-10-08' }],
        })
      }
      return Promise.resolve({ rowCount: 0, rows: [] })
    })
    await updateTask('user-1', 'task-1', { completed: true })
    let insert = clientQuery.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    expect((insert![1] as unknown[])[4]).toBe('2026-11-07')

    clientQuery.mockClear()
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('UPDATE tasks')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: 'task-1', recurring_pattern: 'whenever', due_on: '2026-10-08' }] })
      }
      return Promise.resolve({ rowCount: 0, rows: [] })
    })
    const result = await updateTask('user-1', 'task-1', { completed: true })
    expect(result.nextOccurrenceCreated).toBe(false)
    insert = clientQuery.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    expect(insert).toBeUndefined()
  })

  test('un-completing a recurring task does not spawn an occurrence', async () => {
    const result = await updateTask('user-1', 'task-1', { completed: false })

    expect(result).toEqual({ task: true, nextOccurrenceCreated: false })
    const insert = clientQuery.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    expect(insert).toBeUndefined()
  })

  test('crosses month and year boundaries correctly (UTC arithmetic)', async () => {
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('UPDATE tasks')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: 'task-1', recurring_pattern: 'monthly', due_on: '2026-12-20' }] })
      }
      if (sql.includes('SELECT plan_id')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ plan_id: 'plan-1', title: 'Water', description: null, category: 'water', due_on: '2026-12-20' }],
        })
      }
      return Promise.resolve({ rowCount: 0, rows: [] })
    })
    await updateTask('user-1', 'task-1', { completed: true })

    const insert = clientQuery.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    expect((insert![1] as unknown[])[4]).toBe('2027-01-19')
  })
})
