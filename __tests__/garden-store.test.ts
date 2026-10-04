import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { useGardenStore } from '@/lib/store/garden-store'
import type { GardenBed } from '@/lib/garden/garden-types'
import type { CanvasMetadata, IPersistenceAdapter } from '@/lib/persistence/types'

function makeAdapter() {
  const autoSave = jest.fn<(data: GardenBed[], metadata?: CanvasMetadata, planName?: string) => void>()
  const adapter: IPersistenceAdapter = {
    save: jest.fn(async () => ({ success: true })),
    load: jest.fn(async () => ({ success: true, data: [] })),
    delete: jest.fn(async () => ({ success: true })),
    autoSave,
    hasUnsavedChanges: () => false,
    markAsSaved: jest.fn(),
    getLastSaved: () => null,
  }
  return { adapter, autoSave }
}

describe('garden store auto-save', () => {
  beforeEach(() => {
    useGardenStore.getState().reset()
  })

  test('every mutation routes through the persistence adapter auto-save', () => {
    const { adapter, autoSave } = makeAdapter()
    useGardenStore.getState().setPersistence(adapter)

    useGardenStore.getState().updateBeds([])
    expect(autoSave).toHaveBeenCalledTimes(1)

    useGardenStore.getState().updatePlanName('Backyard Beds')
    expect(autoSave).toHaveBeenCalledTimes(2)

    useGardenStore.getState().updateMetadata({ zoom: 150 })
    expect(autoSave).toHaveBeenCalledTimes(3)

    expect(autoSave).toHaveBeenLastCalledWith([], expect.objectContaining({ zoom: 150 }), 'Backyard Beds')
  })

  test('mutations mark the store dirty', () => {
    const { adapter } = makeAdapter()
    useGardenStore.getState().setPersistence(adapter)

    useGardenStore.getState().updatePlanName('Side Yard')
    expect(useGardenStore.getState().isDirty).toBe(true)
    expect(useGardenStore.getState().planName).toBe('Side Yard')
  })

  test('mutations without a persistence adapter do not throw', () => {
    useGardenStore.getState().setPersistence(null as unknown as IPersistenceAdapter)
    expect(() => useGardenStore.getState().updateMetadata({ zoom: 200 })).not.toThrow()
    expect(useGardenStore.getState().metadata.zoom).toBe(200)
  })
})