/**
 * @jest-environment node
 *
 * Ownership and sanitization for the recording writes (harvests, journal
 * entries, task create/delete). The pool is mocked; assertions are about which
 * SQL runs and with which parameters.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
const queryOne = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown | null>>()
const userOwnsPlan = jest.fn<(userId: string, planId: string) => Promise<boolean>>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
  queryOne: (sql: string, params?: unknown[]) => queryOne(sql, params),
}))

jest.mock('@/lib/db/gardens', () => ({
  userOwnsPlan: (userId: string, planId: string) => userOwnsPlan(userId, planId),
}))

jest.mock('@/lib/db/ids', () => ({
  taskCategory: (value: unknown) => (value === 'plant' ? 'plant' : 'maint'),
}))

let recordings: typeof import('@/lib/db/recordings')

beforeEach(async () => {
  query.mockReset()
  queryOne.mockReset()
  userOwnsPlan.mockReset()
  query.mockResolvedValue([])
  // queryOne serves both the ownership probe (SELECT) and the INSERT ... RETURNING.
  // Route by SQL content: probes return a row, inserts return the created id.
  queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO')) return { id: 'created-1' }
    return { id: 'owned-row' }
  })
  userOwnsPlan.mockResolvedValue(true)
  recordings = await import('@/lib/db/recordings')
})

describe('createHarvest', () => {
  test('inserts with ownership proven through the plan join', async () => {
    const result = await recordings.createHarvest('user-1', {
      plantingId: 'planting-1',
      harvestedOn: '2026-10-08',
      quantity: 2.5,
      unit: 'lbs',
    })

    expect(result).toEqual({ id: 'created-1' })
    const insertCall = queryOne.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO harvests'))
    expect(insertCall).toBeDefined()
    const params = insertCall![1] as unknown[]
    expect(params).toEqual(['planting-1', '2026-10-08', 2.5, 'lbs', null])
  })

  test('rejects a planting on a plan the user does not own', async () => {
    queryOne.mockImplementation(async (sql: string) => {
      // The probe finds nothing; the insert must never run.
      if (sql.includes('INSERT INTO')) throw new Error('INSERT ran despite failed ownership')
      return null
    })
    const result = await recordings.createHarvest('user-1', {
      plantingId: 'someone-elses',
      harvestedOn: '2026-10-08',
    })

    expect(result).toBeNull()
    expect(queryOne).toHaveBeenCalledTimes(1)
    expect((queryOne.mock.calls[0][0] as string)).toContain('JOIN sites s')
  })

  test('rejects a malformed date before touching the database', async () => {
    const result = await recordings.createHarvest('user-1', {
      plantingId: 'planting-1',
      harvestedOn: 'not-a-date',
    })
    expect(result).toBeNull()
    expect(queryOne).not.toHaveBeenCalled()
  })

  test('clamps an absurd quantity and drops bad strings', async () => {
    await recordings.createHarvest('user-1', {
      plantingId: 'planting-1',
      harvestedOn: '2026-10-08',
      quantity: 99_999_999,
      unit: '   ',
      notes: 'x'.repeat(5000),
    })

    const insertCall = queryOne.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO harvests'))
    const params = insertCall![1] as unknown[]
    expect(params[2]).toBe(1_000_000)
    expect(params[3]).toBeNull()
    expect((params[4] as string).length).toBe(2000)
  })
})

describe('createJournalEntry', () => {
  test('inserts for an owned plan with a trimmed title and filtered tags', async () => {
    const result = await recordings.createJournalEntry('user-1', 'plan-1', {
      title: '  First harvest!  ',
      content: '  Tomatoes came in.  ',
      tags: ['tomato', '', 42 as unknown as string, 'compost'],
    })

    expect(result).toEqual({ id: 'created-1' })
    const [sql, params] = queryOne.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO journal_entries')) as unknown as [string, unknown[]]
    expect(sql).toContain('INSERT INTO journal_entries')
    expect(params[2]).toBe('First harvest!')
    expect(params[3]).toBe('Tomatoes came in.')
    expect(params[4]).toEqual(['tomato', 'compost'])
  })

  test('rejects empty content and unowned plans', async () => {
    expect(await recordings.createJournalEntry('user-1', 'plan-1', { content: '   ' })).toBeNull()

    userOwnsPlan.mockResolvedValueOnce(false)
    expect(await recordings.createJournalEntry('user-1', 'plan-1', { content: 'hi' })).toBeNull()
    expect(queryOne).not.toHaveBeenCalled()
  })
})

describe('createTask', () => {
  test('inserts with the category mapped through taskCategory', async () => {
    const result = await recordings.createTask('user-1', 'plan-1', {
      title: 'Water the beds',
      dueOn: '2026-10-10',
      category: 'plant',
    })

    expect(result).toEqual({ id: 'created-1' })
    const insertCall = queryOne.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    const params = insertCall![1] as unknown[]
    expect(params[5]).toBe('plant')
  })

  test('an unknown category maps to maint so the enum cast cannot fail', async () => {
    await recordings.createTask('user-1', 'plan-1', {
      title: 'Something',
      dueOn: '2026-10-10',
      category: 'not-a-category',
    })

    const insertCall = queryOne.mock.calls.find((call) => (call[0] as string).includes('INSERT INTO tasks'))
    const params = insertCall![1] as unknown[]
    expect(params[5]).toBe('maint')
  })

  test('rejects unowned plans and empty titles', async () => {
    userOwnsPlan.mockResolvedValueOnce(false)
    expect(
      await recordings.createTask('user-1', 'plan-1', { title: 'x', dueOn: '2026-10-10' })
    ).toBeNull()

    expect(
      await recordings.createTask('user-1', 'plan-1', { title: '  ', dueOn: '2026-10-10' })
    ).toBeNull()
    expect(queryOne).not.toHaveBeenCalled()
  })
})

describe('deletes', () => {
  test('deleteTask proves ownership through the plan join', async () => {
    query.mockResolvedValueOnce([{ id: 'task-1' }])
    const deleted = await recordings.deleteTask('user-1', 'task-1')

    expect(deleted).toBe(true)
    const [sql] = query.mock.calls[0] as unknown as [string]
    expect(sql).toContain('DELETE FROM tasks')
    expect(sql).toContain('s.user_id = $2')
  })

  test('deleteHarvest and deleteJournalEntry return false when nothing matched', async () => {
    expect(await recordings.deleteHarvest('user-1', 'nope')).toBe(false)
    expect(await recordings.deleteJournalEntry('user-1', 'nope')).toBe(false)
  })
})
