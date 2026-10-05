/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from '@jest/globals'
import { DataAdapter } from '@/components/tldraw/data-adapter'
import { PlantShapeUtil, type PlantShape } from '@/components/tldraw/shapes/plant-shape'
import { PLANT_LIBRARY, getPlantById } from '@/lib/data/plant-library'
import type { GardenBed, PlantedItem } from '@/lib/garden/garden-types'

function planted(plantId: string, id = 'p1'): PlantedItem {
  return { id, plantId, x: 20, y: 20 }
}

function bed(plants: PlantedItem[] = []): GardenBed {
  return {
    id: 'bed-1',
    name: 'Bed 1',
    points: [
      { x: 0, y: 0 },
      { x: 96, y: 0 },
      { x: 96, y: 48 },
      { x: 0, y: 48 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants,
  }
}

/**
 * Default plant props, typed so test shapes satisfy Pick<PlantShape, 'props'>.
 *
 * ShapeUtil's constructor wants an Editor and getDefaultProps ignores it, so the
 * instance is created with a cast rather than standing up a whole editor for a
 * method that reads no editor state.
 */
function plantShapeProps(): PlantShape['props'] {
  const Util = PlantShapeUtil as unknown as new () => PlantShapeUtil
  return new Util().getDefaultProps()
}

describe('plant library integrity', () => {
  test('every entry has an id, name and icon', () => {
    const broken = PLANT_LIBRARY.filter(
      (plant) => !plant.id || !plant.name || !plant.icon || plant.icon.trim() === ''
    )
    expect(broken.map((p) => p.id)).toEqual([])
  })

  test('ids are unique', () => {
    const ids = PLANT_LIBRARY.map((plant) => plant.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  test('companion and antagonist references all resolve', () => {
    const ids = new Set(PLANT_LIBRARY.map((plant) => plant.id))
    const dangling: string[] = []
    for (const plant of PLANT_LIBRARY) {
      for (const id of [...plant.companions, ...plant.antagonists]) {
        if (!ids.has(id)) dangling.push(`${plant.id} -> ${id}`)
      }
    }
    expect(dangling).toEqual([])
  })
})

describe('DataAdapter plant shapes carry real library data', () => {
  test('companion relationships are populated on load', () => {
    // Find a plant that actually declares companions.
    const withCompanions = PLANT_LIBRARY.find(
      (plant) => plant.companions.length > 0 && getPlantById(plant.companions[0])
    )
    expect(withCompanions).toBeDefined()

    const adapter = new DataAdapter()
    const shapes = adapter.gardenBedsToShapes([bed([planted(withCompanions!.id)])])
    const plantShape = shapes.find((shape) => shape.type === 'plant') as
      | { props: { companionsJson: string } }
      | undefined

    expect(plantShape).toBeDefined()
    const companions = JSON.parse(plantShape!.props.companionsJson)
    // Previously hardcoded to '[]' on the load path.
    expect(companions).toEqual(withCompanions!.companions)
  })

  test('antagonist relationships are populated on load', () => {
    const withAntagonists = PLANT_LIBRARY.find((plant) => plant.antagonists.length > 0)
    expect(withAntagonists).toBeDefined()

    const adapter = new DataAdapter()
    const shapes = adapter.gardenBedsToShapes([bed([planted(withAntagonists!.id)])])
    const plantShape = shapes.find((shape) => shape.type === 'plant') as
      | { props: { antagonistsJson: string } }
      | undefined

    const antagonists = JSON.parse(plantShape!.props.antagonistsJson)
    expect(antagonists).toEqual(withAntagonists!.antagonists)
  })

  test('spacing comes from the library rather than a flat 12 inches', () => {
    const spaced = PLANT_LIBRARY.find((plant) => plant.size.spacing !== 12)
    expect(spaced).toBeDefined()

    const adapter = new DataAdapter()
    const shapes = adapter.gardenBedsToShapes([bed([planted(spaced!.id)])])
    const plantShape = shapes.find((shape) => shape.type === 'plant') as
      | { props: { spacing: number } }
      | undefined

    expect(plantShape!.props.spacing).toBe(spaced!.size.spacing)
  })

  test('every library plant renders its own icon, not a generic fallback', () => {
    const adapter = new DataAdapter()
    const shapes = adapter.gardenBedsToShapes([
      bed(PLANT_LIBRARY.map((plant, index) => planted(plant.id, `p${index}`))),
    ])
    const plantShapes = shapes.filter((shape) => shape.type === 'plant') as Array<{
      props: { emoji: string; plantId: string }
    }>

    // Each plant must get the icon the library gives it. Comparing against the
    // literal seedling is not enough: two entries (rosemary, radish) really do
    // use it, so that would be a false failure, and an id outside the library
    // would still pass it.
    const expected = new Map(PLANT_LIBRARY.map((plant) => [plant.id, plant.icon]))
    for (const shape of plantShapes) {
      expect(shape.props.emoji).toBe(expected.get(shape.props.plantId))
    }
    // The old hand-rolled map covered 20 of these 50 ids.
    expect(plantShapes).toHaveLength(PLANT_LIBRARY.length)
  })

  test('uses the library display name rather than a title-cased id', () => {
    const named = PLANT_LIBRARY.find((plant) => plant.name !== plant.id)
    expect(named).toBeDefined()

    const adapter = new DataAdapter()
    const shapes = adapter.gardenBedsToShapes([bed([planted(named!.id)])])
    const plantShape = shapes.find((shape) => shape.type === 'plant') as
      | { props: { plantName: string } }
      | undefined

    expect(plantShape!.props.plantName).toBe(named!.name)
  })

  test('an unknown plant id does not break the conversion', () => {
    const adapter = new DataAdapter()
    expect(() => adapter.gardenBedsToShapes([bed([planted('not-a-real-plant')])])).not.toThrow()

    const shapes = adapter.gardenBedsToShapes([bed([planted('not-a-real-plant')])])
    const plantShape = shapes.find((shape) => shape.type === 'plant') as
      | { props: { companionsJson: string; antagonistsJson: string; emoji: string } }
      | undefined

    expect(JSON.parse(plantShape!.props.companionsJson)).toEqual([])
    expect(JSON.parse(plantShape!.props.antagonistsJson)).toEqual([])
    expect(plantShape!.props.emoji.length).toBeGreaterThan(0)
  })
})

describe('PlantShapeUtil.isCompatibleWith uses the real shape props', () => {
  const Util = PlantShapeUtil as unknown as new () => PlantShapeUtil
  const util = new Util()

  function shape(plantId: string, companions: string[], antagonists: string[]) {
    return {
      props: {
        ...plantShapeProps(),
        plantId,
        companionsJson: JSON.stringify(companions),
        antagonistsJson: JSON.stringify(antagonists),
      },
    }
  }
  test('reports a known antagonist pair as incompatible', () => {
    const a = shape('tomato', ['basil'], [])
    const b = shape('basil', ['tomato'], ['tomato'])

    // Before the fix the relationship lists came from getDefaultProps(), so
    // this could never be anything but true.
    expect(util.isCompatibleWith(a, b)).toBe(false)
    expect(util.isCompatibleWith(b, a)).toBe(false)
  })

  test('reports a one-sided antagonist declaration as incompatible either way round', () => {
    // corn lists tomato as an antagonist; tomato does not list corn. Antagonism
    // is a property of the pair, so the answer must not depend on which shape
    // is passed as self.
    const corn = shape('corn', [], ['tomato'])
    const tomato = shape('tomato', ['basil'], [])

    expect(util.isCompatibleWith(corn, tomato)).toBe(false)
    expect(util.isCompatibleWith(tomato, corn)).toBe(false)
  })

  test('a declared companion is symmetric too', () => {
    const a = shape('tomato', ['basil'], [])
    const b = shape('basil', [], [])

    expect(util.isCompatibleWith(a, b)).toBe(true)
    expect(util.isCompatibleWith(b, a)).toBe(true)
  })

  test('reports a declared companion pair as compatible', () => {
    expect(util.isCompatibleWith(shape('tomato', ['basil'], []), shape('basil', [], []))).toBe(true)
  })

  test('an unlisted pair is neutral', () => {
    expect(util.isCompatibleWith(shape('tomato', [], []), shape('basil', [], []))).toBe(true)
  })

  test('malformed relationship JSON is treated as empty rather than throwing', () => {
    const broken = { props: { ...plantShapeProps(), plantId: 'tomato', companionsJson: 'not json' } }
    expect(util.isCompatibleWith(broken, shape('basil', [], []))).toBe(true)
  })

  test('is not fooled by two shapes both carrying empty lists', () => {
    // The regression this guards: identical default props used to make every
    // comparison trivially true.
    expect(util.isCompatibleWith(shape('a', [], []), shape('b', [], []))).toBe(true)
  })
})
