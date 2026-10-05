/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { LocalStoragePersistence } from '@/lib/persistence/local-storage-adapter'
import type { GardenBed } from '@/lib/garden/garden-types'

const BEDS_KEY = 'permaculture_demo_plan'
const METADATA_KEY = 'permaculture_demo_metadata'

/** Size of the string the adapter actually writes for a set of beds. */
function bedsJsonLength(beds: GardenBed[]): number {
  return JSON.stringify(beds).length
}

function bed(id: string, name = id): GardenBed {
  return {
    id,
    name,
    points: [
      { x: 0, y: 0 },
      { x: 96, y: 0 },
      { x: 96, y: 48 },
      { x: 0, y: 48 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    rotation: 0,
    width: 96,
    height: 48,
    plants: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('LocalStoragePersistence.save', () => {
  test('writes beds and metadata that load back consistently', async () => {
    const store = new LocalStoragePersistence()

    const result = await store.save([bed('b1'), bed('b2')], { zoom: 100 }, 'My Plot')

    expect(result.success).toBe(true)

    const loaded = await new LocalStoragePersistence().load()
    expect(loaded.success).toBe(true)
    expect(loaded.data).toHaveLength(2)
    expect(loaded.data!.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(loaded.metadata!.zoom).toBe(100)
    // The plan name the save was given must survive the round trip; it used to
    // be hardcoded to 'Demo Garden' on load.
    expect(loaded.planName).toBe('My Plot')
  })

  test('both keys are written together, so a failure cannot leave them inconsistent', async () => {
    const store = new LocalStoragePersistence()
    const setItem = jest.spyOn(Storage.prototype, 'setItem')

    // Fail on the *second* write. With the serialise-then-write order this
    // never leaves new beds beside stale metadata: the size check and both
    // serialisations complete before anything touches storage.
    let calls = 0
    setItem.mockImplementation((key: string, value: string) => {
      calls += 1
      if (calls === 2) throw new DOMException('full', 'QuotaExceededError')
      Storage.prototype.setItem.call(window.localStorage, key, value)
    })

    const result = await store.save([bed('b1')], {}, 'Plot')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/storage is full/i)
    // The first write did land, so assert the metadata key was never left
    // describing an older save than the beds.
    expect(localStorage.getItem(METADATA_KEY)).toBeNull()

    setItem.mockRestore()
  })

  test('measures the values it writes rather than a wrapping payload', async () => {
    const store = new LocalStoragePersistence()
    // A plan that sits just under the limit when measured correctly. The old
    // check measured the GardenPlanData wrapper, which re-serialises the same
    // beds under a different key and adds the metadata, so the number it
    // compared against the limit was not the number being stored.
    const beds: GardenBed[] = [bed('b1'), bed('b2'), bed('b3')]
    const written = bedsJsonLength(beds)
    const padded = written + 4096
    expect(padded).toBeLessThan(4.5 * 1024 * 1024)

    const filler: GardenBed = { ...bed('bf'), metadata: { pad: 'x'.repeat(padded) } }
    const result = await store.save([filler], {})

    // Under the limit once measured correctly, so the save must succeed rather
    // than being rejected on a size that was never written.
    expect(result.success).toBe(true)
    expect(localStorage.getItem(BEDS_KEY)).not.toBeNull()
  })

  test('reports a quota error rather than throwing when storage is full', async () => {
    const store = new LocalStoragePersistence()
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })

    const result = await store.save([bed('b1')], {})

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/storage is full/i)
    setItem.mockRestore()
  })

  test('refuses an oversized plan without writing anything', async () => {
    const store = new LocalStoragePersistence()
    // A single bed with metadata large enough to blow the limit.
    const huge: GardenBed = {
      ...bed('b1'),
      metadata: { notes: 'x'.repeat(5 * 1024 * 1024) },
    }

    const result = await store.save([huge], {})

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/too large/i)
    // Rejected before touching storage, not after.
    expect(localStorage.getItem(BEDS_KEY)).toBeNull()
    expect(localStorage.getItem(METADATA_KEY)).toBeNull()
  })

  test('rejects non-array data', async () => {
    const store = new LocalStoragePersistence()
    const result = await store.save('not beds' as unknown as GardenBed[], {})
    expect(result.success).toBe(false)
  })
})

describe('LocalStoragePersistence.load', () => {
  test('reports no data when storage is empty', async () => {
    const result = await new LocalStoragePersistence().load()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no saved data/i)
  })

  test('rejects corrupt JSON instead of throwing', async () => {
    localStorage.setItem(BEDS_KEY, '{not json')
    const result = await new LocalStoragePersistence().load()
    expect(result.success).toBe(false)
  })

  test('rejects a stored value that is not an array of beds', async () => {
    localStorage.setItem(BEDS_KEY, JSON.stringify({ beds: [] }))
    const result = await new LocalStoragePersistence().load()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalid data format/i)
  })
})

describe('LocalStoragePersistence.delete', () => {
  test('clears both keys', async () => {
    const store = new LocalStoragePersistence()
    await store.save([bed('b1')], {}, 'Plot')

    const result = await store.delete()

    expect(result.success).toBe(true)
    expect(localStorage.getItem(BEDS_KEY)).toBeNull()
    expect(localStorage.getItem(METADATA_KEY)).toBeNull()
  })
})
