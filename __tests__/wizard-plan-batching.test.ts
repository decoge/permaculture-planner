/**
 * @jest-environment node
 *
 * Imported dynamically so the pool mock is registered first. Note the
 * '@/lib/db/ids' mock: the real one imports `uuid`, which is ESM-only and cannot
 * be required under Jest's CommonJS runtime.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const clientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>>()
let uuidCounter = 0

jest.mock('@/lib/db/pool', () => ({
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => clientQuery(sql, params) }),
  query: jest.fn(),
  queryOne: jest.fn(),
}))

jest.mock('@/lib/db/ids', () => ({
  asUuid: () => `bed-uuid-${(uuidCounter += 1)}`,
  clampHeight: (value: number) => Math.min(48, Math.max(6, value)),
  familyOrOther: (value: unknown) => (value === 'Solanaceae' ? 'Solanaceae' : 'Other'),
  surfaceOrSoil: (value: unknown) => (value === 'hard' ? 'hard' : 'soil'),
  taskCategory: (value: unknown) => (value === 'plant' ? 'plant' : 'maint'),
  waterOrSpigot: () => 'spigot',
}))

let createWizardPlan: typeof import('@/lib/db/wizard-plan')['createWizardPlan']

beforeEach(async () => {
  clientQuery.mockReset()
  uuidCounter = 0
  clientQuery.mockImplementation(async (sql: string) => {
    // sites and plans both RETURNING an id.
    if (sql.includes('INSERT INTO sites')) return { rowCount: 1, rows: [{ id: 'site-1' }] }
    if (sql.includes('INSERT INTO plans')) return { rowCount: 1, rows: [{ id: 'plan-1' }] }
    return { rowCount: 1, rows: [] }
  })
  const wizard = await import('@/lib/db/wizard-plan')
  createWizardPlan = wizard.createWizardPlan
})

function paramsFor(fragment: string): unknown[] {
  const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes(fragment))
  if (!call) throw new Error(`no statement containing ${JSON.stringify(fragment)}`)
  return call[1] as unknown[]
}

function bed(index: number, name = `Bed ${index + 1}`) {
  return {
    name,
    lengthFt: 8,
    widthFt: 4,
    heightIn: 12,
    orientation: 'NS' as const,
    orderIndex: index,
  }
}

const MATERIALS = {
  soilCuft: 10,
  compostCuft: 2,
  mulchCuft: 3,
  lumberBoardFeet: 40,
  screws: 100,
  dripLineFt: 50,
  emitters: 20,
  rowCoverSqFt: 10,
  costCents: 12345,
}

describe('createWizardPlan', () => {
  test('a plan with many beds, plantings and tasks uses a fixed number of statements', async () => {
    const result = await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: Array.from({ length: 25 }, (_, i) => bed(i)),
      plantings: Array.from({ length: 30 }, (_, i) => ({
        bedName: `Bed ${(i % 25) + 1}`,
        season: 'spring',
        year: 2026,
        spacingIn: 12,
      })),
      tasks: Array.from({ length: 12 }, (_, i) => ({
        title: `Task ${i}`,
        dueOn: '2026-03-01',
        category: 'build',
      })),
      materials: MATERIALS,
    })

    expect(result).toEqual({ id: 'plan-1', siteId: 'site-1' })
    // site + plan + beds + plantings + tasks + materials, regardless of size.
    expect(clientQuery).toHaveBeenCalledTimes(6)
  })

  test('plantings point at bed ids from the same batched insert', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [bed(0, 'Bed A'), bed(1, 'Bed B')],
      plantings: [
        { bedName: 'Bed A', season: 'summer', year: 2026, spacingIn: 18 },
        { bedName: 'Bed B', season: 'fall', year: 2026, spacingIn: 12 },
      ],
      tasks: [],
      materials: MATERIALS,
    })

    const bedIds = paramsFor('INSERT INTO beds')[1] as string[]
    const plantingBedIds = paramsFor('INSERT INTO plantings')[0] as string[]
    const names = paramsFor('INSERT INTO beds')[2] as string[]

    expect(names).toEqual(['Bed A', 'Bed B'])
    // Each planting resolved to the bed with the matching name.
    expect(plantingBedIds).toEqual([bedIds[0], bedIds[1]])
  })

  test('drops a planting whose bedName matches no saved bed', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [bed(0, 'Bed A')],
      plantings: [
        { bedName: 'Bed A', season: 'spring', year: 2026, spacingIn: 12 },
        { bedName: 'Bed Z', season: 'spring', year: 2026, spacingIn: 12 },
      ],
      tasks: [],
      materials: MATERIALS,
    })

    expect(paramsFor('INSERT INTO plantings')[0]).toHaveLength(1)
  })

  test('skips the plantings and tasks inserts when there are none', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [bed(0)],
      plantings: [],
      tasks: [],
      materials: MATERIALS,
    })

    const sql = clientQuery.mock.calls.map((c) => c[0] as string).join('\n')
    expect(sql).not.toContain('INSERT INTO plantings')
    expect(sql).not.toContain('INSERT INTO tasks')
    expect(sql).toContain('INSERT INTO materials_estimates')
  })

  test('a plan with no beds still saves and omits the beds insert', async () => {
    const result = await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [],
      plantings: [{ bedName: 'Bed 1', season: 'spring', year: 2026, spacingIn: 12 }],
      tasks: [],
      materials: MATERIALS,
    })

    expect(result).toEqual({ id: 'plan-1', siteId: 'site-1' })
    const sql = clientQuery.mock.calls.map((c) => c[0] as string).join('\n')
    expect(sql).not.toContain('INSERT INTO beds')
    // The orphaned planting is dropped along with the beds.
    expect(sql).not.toContain('INSERT INTO plantings')
  })

  test('clamps out-of-range bed dimensions before writing', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [
        { name: 'Huge', lengthFt: 5000, widthFt: -3, heightIn: 999, orientation: 'EW', orderIndex: 0 },
      ],
      plantings: [],
      tasks: [],
      materials: MATERIALS,
    })

    const params = paramsFor('INSERT INTO beds')
    expect(params[3]).toEqual([100]) // length clamped
    expect(params[4]).toEqual([0.1]) // width floored
    expect(params[5]).toEqual([48]) // height clamped
    expect(params[6]).toEqual(['EW'])
  })

  test('normalises an unknown season and an unknown family', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [bed(0)],
      plantings: [
        { bedName: 'Bed 1', season: 'monsoon', year: 2026, spacingIn: 12, family: 'Arecaceae' },
      ],
      tasks: [],
      materials: MATERIALS,
    })

    const params = paramsFor('INSERT INTO plantings')
    expect(params[1]).toEqual(['spring'])
    expect(params[5]).toEqual(['Other'])
  })

  test('stores task due dates as dates, not timestamps', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [],
      plantings: [],
      tasks: [{ title: 'Buy lumber', dueOn: '2026-03-01T10:30:00.000Z', category: 'build' }],
      materials: MATERIALS,
    })

    const [sql, params] = clientQuery.mock.calls.find((c) =>
      (c[0] as string).includes('INSERT INTO tasks')
    ) as [string, unknown[]]
    expect(sql).toContain('t.due::date')
    expect(params[3]).toEqual(['2026-03-01'])
  })

  test('drops blank task titles', async () => {
    await createWizardPlan({
      userId: 'user-1',
      site: { name: 'Site' },
      planName: 'Plan',
      beds: [],
      plantings: [],
      tasks: [
        { title: '   ', dueOn: '2026-03-01', category: 'build' },
        { title: 'Buy lumber', dueOn: '2026-03-01', category: 'build' },
      ],
      materials: MATERIALS,
    })

    expect(paramsFor('INSERT INTO tasks')[1]).toEqual(['Buy lumber'])
  })
})
