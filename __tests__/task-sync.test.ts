/**
 * @jest-environment node
 *
 * lib/db/tasks is imported dynamically after jest.mock is registered, so the
 * mocks below are in place before it binds its copy of '@/lib/db/pool'.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
const queryOne = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>()
const clientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
  queryOne: (sql: string, params?: unknown[]) => queryOne(sql, params),
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => clientQuery(sql, params) }),
}))

jest.mock('@/lib/db/gardens', () => ({
  userOwnsPlan: async () => true,
}))

jest.mock('@/lib/db/ids', () => ({
  taskCategory: (value: unknown) =>
    ['build', 'plant', 'maintain', 'harvest', 'water', 'fertilize', 'cover'].includes(
      value as string
    )
      ? value
      : 'maint',
}))

type TasksModule = typeof import('@/lib/db/tasks')
let syncGeneratedTasks: TasksModule['syncGeneratedTasks']

beforeEach(async () => {
  query.mockReset()
  queryOne.mockReset()
  clientQuery.mockReset()
  query.mockResolvedValue([])
  const tasks = await import('@/lib/db/tasks')
  syncGeneratedTasks = tasks.syncGeneratedTasks
})

function task(title: string, due_on: string, category = 'build') {
  return { title, due_on, category }
}

describe('syncGeneratedTasks', () => {
  test('inserts a whole batch in a single statement', async () => {
    const result = await syncGeneratedTasks('user-1', 'plan-1', [
      task('Buy lumber', '2026-03-01'),
      task('Assemble beds', '2026-03-05'),
      task('Fill with soil', '2026-03-08'),
    ])

    expect(result).toEqual({ tasksCreated: 3 })
    // One INSERT for three tasks; the old loop issued three.
    expect(clientQuery).toHaveBeenCalledTimes(1)

    const [sql, params] = clientQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('unnest')
    // plan id plus the five parallel arrays.
    expect(params[0]).toBe('plan-1')
    expect(params[1]).toEqual(['Buy lumber', 'Assemble beds', 'Fill with soil'])
    expect(params[4]).toEqual(['2026-03-01', '2026-03-05', '2026-03-08'])
  })

  test('skips tasks that already exist and does not insert at all if none are new', async () => {
    query.mockResolvedValue([
      { title: 'Buy lumber', due_on: '2026-03-01' },
      { title: 'Assemble beds', due_on: '2026-03-05' },
    ])

    const result = await syncGeneratedTasks('user-1', 'plan-1', [
      task('Buy lumber', '2026-03-01'),
      task('Assemble beds', '2026-03-05'),
    ])

    expect(result).toEqual({ tasksCreated: 0 })
    expect(clientQuery).not.toHaveBeenCalled()
  })

  test('deduplicates repeats within a single request', async () => {
    const result = await syncGeneratedTasks('user-1', 'plan-1', [
      task('Buy lumber', '2026-03-01'),
      task('Buy lumber', '2026-03-01'),
    ])

    expect(result).toEqual({ tasksCreated: 1 })
    const [, params] = clientQuery.mock.calls[0] as [string, unknown[]]
    expect(params[1]).toEqual(['Buy lumber'])
  })

  test('treats the same title on a different date as a new task', async () => {
    const result = await syncGeneratedTasks('user-1', 'plan-1', [
      task('Water beds', '2026-03-01'),
      task('Water beds', '2026-03-02'),
    ])

    expect(result).toEqual({ tasksCreated: 2 })
  })

  test('drops blank titles rather than writing empty task rows', async () => {
    const result = await syncGeneratedTasks('user-1', 'plan-1', [
      task('   ', '2026-03-01'),
      task('Buy lumber', '2026-03-01'),
    ])

    expect(result).toEqual({ tasksCreated: 1 })
    const [, params] = clientQuery.mock.calls[0] as [string, unknown[]]
    expect(params[1]).toEqual(['Buy lumber'])
  })

  test('truncates the title to a date only, not a full timestamp', async () => {
    await syncGeneratedTasks('user-1', 'plan-1', [
      task('Buy lumber', '2026-03-01T12:00:00.000Z'),
    ])

    const [sql, params] = clientQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('t.due::date')
    expect(params[4]).toEqual(['2026-03-01'])
  })

  test('caps an oversized batch', async () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      task(`Task ${index}`, `2026-03-01`)
    )

    const result = await syncGeneratedTasks('user-1', 'plan-1', many)

    expect(result!.tasksCreated).toBeLessThanOrEqual(200)
    // Still one statement, whatever the batch size.
    expect(clientQuery).toHaveBeenCalledTimes(1)
  })

  test('maps an unknown category to the valid default instead of failing the insert', async () => {
    await syncGeneratedTasks('user-1', 'plan-1', [
      { title: 'Mow lawn', due_on: '2026-03-01', category: 'nonsense' },
    ])

    const [, params] = clientQuery.mock.calls[0] as [string, unknown[]]
    expect(params[3]).toEqual(['maint'])
  })
})
