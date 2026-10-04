import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { useGardenStore } from '@/lib/store/garden-store'
import type { GardenBed } from '@/lib/garden/garden-types'
import type {
  CanvasMetadata,
  IPersistenceAdapter,
  SaveResult,
} from '@/lib/persistence/types'

const BED: GardenBed = {
  id: 'bed-1',
  name: 'Bed 1',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
  fill: '#e0f2e0',
  stroke: '#22c55e',
  plants: [],
}

type Overrides = Partial<IPersistenceAdapter>

function makeAdapter(overrides: Overrides = {}) {
  const save: jest.Mock<(data: GardenBed[], metadata?: CanvasMetadata, planName?: string) => Promise<SaveResult>> =
    jest.fn(async () => ({ success: true, planId: 'plan-1' }))
  const load = jest.fn(async () => ({ success: true, data: [] as GardenBed[] }))
  const remove = jest.fn(async () => ({ success: true }))
  const adapter: IPersistenceAdapter = {
    save,
    load,
    delete: remove,
    autoSave: jest.fn(),
    hasUnsavedChanges: () => false,
    markAsSaved: jest.fn(),
    getLastSaved: () => null,
    ...overrides,
  }
  return { adapter, save, load, remove }
}

describe('garden store persistence', () => {
  beforeEach(() => {
    useGardenStore.getState().reset()
  })

  test('save delegates to the adapter and clears the dirty flag', async () => {
    const { adapter, save } = makeAdapter()
    useGardenStore.getState().setPersistence(adapter)
    useGardenStore.getState().updatePlanName('Kitchen Plot')
    expect(useGardenStore.getState().isDirty).toBe(true)

    await useGardenStore.getState().save()

    expect(save).toHaveBeenCalledWith(
      useGardenStore.getState().beds,
      useGardenStore.getState().metadata,
      'Kitchen Plot'
    )
    expect(useGardenStore.getState().isDirty).toBe(false)
    expect(useGardenStore.getState().planId).toBe('plan-1')
    expect(useGardenStore.getState().isLoading).toBe(false)
  })

  test('save surfaces an adapter-reported failure', async () => {
    const { adapter } = makeAdapter({ save: jest.fn(async () => ({ success: false, error: 'quota exceeded' })) })
    useGardenStore.getState().setPersistence(adapter)

    await useGardenStore.getState().save()

    expect(useGardenStore.getState().error).toBe('quota exceeded')
    expect(useGardenStore.getState().isLoading).toBe(false)
  })

  test('save surfaces a thrown adapter error without leaving the store loading', async () => {
    const { adapter } = makeAdapter({
      save: jest.fn(async () => {
        throw new Error('network down')
      }),
    })
    useGardenStore.getState().setPersistence(adapter)

    await useGardenStore.getState().save()

    expect(useGardenStore.getState().error).toBe('network down')
    expect(useGardenStore.getState().isLoading).toBe(false)
  })

  test('load replaces beds and merges metadata', async () => {
    const { adapter } = makeAdapter({
      load: jest.fn(async () => ({
        success: true,
        data: [BED],
        metadata: { zoom: 200 } as CanvasMetadata,
        planName: 'Loaded Plan',
      })),
    })
    useGardenStore.getState().setPersistence(adapter)

    await useGardenStore.getState().load('plan-9')

    expect(useGardenStore.getState().beds).toEqual([BED])
    expect(useGardenStore.getState().metadata.zoom).toBe(200)
    // Untouched metadata keys survive the merge.
    expect(useGardenStore.getState().metadata.showGrid).toBe(true)
    expect(useGardenStore.getState().planName).toBe('Loaded Plan')
    expect(useGardenStore.getState().isDirty).toBe(false)
  })

  test('load failure records the error and keeps existing beds', async () => {
    const { adapter } = makeAdapter({ load: jest.fn(async () => ({ success: false, error: 'not found' })) })
    useGardenStore.getState().setPersistence(adapter)
    useGardenStore.getState().updateBeds([BED])

    await useGardenStore.getState().load()

    expect(useGardenStore.getState().error).toBe('not found')
    expect(useGardenStore.getState().beds).toEqual([BED])
  })

  test('clear resets state but keeps the configured adapter', async () => {
    const { adapter, remove } = makeAdapter()
    useGardenStore.getState().setPersistence(adapter)
    useGardenStore.getState().updateBeds([BED])

    await useGardenStore.getState().clear()

    expect(remove).toHaveBeenCalled()
    expect(useGardenStore.getState().beds).toEqual([])
    expect(useGardenStore.getState().planName).toBe('Untitled Garden')
    expect(useGardenStore.getState().persistence).toBe(adapter)
  })

  test('persistence actions without an adapter report an error instead of throwing', async () => {
    const store = useGardenStore.getState()

    await store.save()
    expect(useGardenStore.getState().error).toBe('No persistence adapter configured')

    await store.load()
    expect(useGardenStore.getState().error).toBe('No persistence adapter configured')

    await store.clear()
    expect(useGardenStore.getState().error).toBe('No persistence adapter configured')
  })

  test('error helpers set and clear the message', () => {
    useGardenStore.getState().setError('boom')
    expect(useGardenStore.getState().error).toBe('boom')

    useGardenStore.getState().clearError()
    expect(useGardenStore.getState().error).toBeNull()
  })
})