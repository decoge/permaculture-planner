import { createShapeId, TLShape } from 'tldraw'
import { GardenBed, PlantedItem } from '@/lib/garden/garden-types'
import { placeBedPoints } from '@/lib/garden/bed-geometry'
import { bedLabelWidth, placePlantsInBed } from '@/lib/garden/plant-label-layout'
import { PLANT_LIBRARY, getPlantById } from '@/lib/data/plant-library'
import { BedShape } from './shapes/bed-shape'
import { PlantShape } from './shapes/plant-shape'
import { ElementShape } from './shapes/element-shape'
import { ELEMENT_STYLES, type ElementSubtype } from '@/lib/canvas-elements'

/** Stable garden id stored on a tldraw shape, without the `shape:` prefix. */
export function gardenIdFromShape(shape: { id: string; meta?: unknown }): string {
  const meta = shape.meta as { gardenId?: unknown } | undefined
  if (typeof meta?.gardenId === 'string' && meta.gardenId.length > 0) return meta.gardenId
  return shape.id.startsWith('shape:') ? shape.id.slice('shape:'.length) : shape.id
}

/**
 * DataAdapter converts between legacy GardenBed format and tldraw shapes
 *
 * This adapter ensures backward compatibility with existing garden data
 * while leveraging tldraw's high-performance shape system.
 */
export class DataAdapter {
  /**
   * Convert GardenBed array to tldraw shapes
   *
   * @param beds Array of garden beds from legacy format
   * @returns Array of tldraw shapes (BedShape and PlantShape)
   */
  gardenBedsToShapes(beds: GardenBed[]): TLShape[] {
    const shapes: TLShape[] = []

    for (const bed of beds) {
      // A saved element (pond, swale, shed) is not a bed: restoring it as a bed
      // shape would render it without its icon or geometry, and the element
      // tools would not recognise it.
      if (bed.elementCategory && bed.elementCategory !== 'bed') {
        shapes.push(this.elementToShape(bed))
        continue
      }

      // Create bed shape
      const bedShape: BedShape = {
        id: createShapeId(bed.id),
        type: 'bed',
        x: this.getBedX(bed.points),
        y: this.getBedY(bed.points),
        rotation: bed.rotation || 0,
        isLocked: false,
        opacity: 1,
        props: {
          w: bed.width || this.calculateWidth(bed.points),
          h: bed.height || this.calculateHeight(bed.points),
          name: bed.name,
          color: bed.stroke,
          // Serialize points as JSON string for tldraw compatibility
          pointsJson: bed.points && bed.points.length > 2
            ? JSON.stringify(this.normalizePoints(bed.points))
            : '[]',
          elementType: bed.elementType || '',
          elementCategory: bed.elementCategory || 'bed',
          zone: bed.zone ?? -1, // -1 means no zone
        },
        meta: {
          originalFill: bed.fill,
          gardenId: bed.id,
          // Serialize metadata to ensure JSON-serializable .meta property
          ...(bed.metadata ? { metadataJson: JSON.stringify(bed.metadata) } : {}),
        },
        parentId: 'page:page' as any,
        index: 'a1' as any,
        typeName: 'shape',
      }

      shapes.push(bedShape)

      if (bed.plants && bed.plants.length > 0) {
        const width = bed.width || this.calculateWidth(bed.points)
        const height = bed.height || this.calculateHeight(bed.points)
        const spots = placePlantsInBed(
          bed.plants.map((plant) => ({
            id: plant.id,
            name: this.getPlantName(plant.plantId),
            x: plant.x,
            y: plant.y,
          })),
          width,
          height,
        )
        const spotById = new Map(spots.map((spot) => [spot.id, spot]))
        for (const plant of bed.plants) {
          const spot = spotById.get(plant.id)
          if (!spot) continue
          shapes.push(this.plantToShape(plant, bed, spot, bedLabelWidth(width)))
        }
      }
    }

    return shapes
  }

  /**
   * Convert tldraw shapes back to GardenBed array
   *
   * @param shapes Array of tldraw shapes
   * @returns Array of garden beds in legacy format
   */
  shapesToGardenBeds(shapes: TLShape[]): GardenBed[] {
    const beds: GardenBed[] = []

    // Get all bed shapes
    const bedShapes = shapes.filter(s => s.type === 'bed') as BedShape[]
    const plantShapes = shapes.filter(s => s.type === 'plant') as PlantShape[]

    for (const bedShape of bedShapes) {
      // Find plants that belong to this bed (by spatial containment)
      const bedBounds = this.getShapeBounds(bedShape)
      const bedId = gardenIdFromShape(bedShape)
      const bedPlants: PlantedItem[] = []

      for (const plantShape of plantShapes) {
        const taggedBed = typeof plantShape.meta?.bedId === 'string' ? plantShape.meta.bedId : ''
        const belongs = taggedBed === bedId || (!taggedBed && this.isPlantInBed(plantShape, bedBounds))
        if (belongs) {
          bedPlants.push({
            id: gardenIdFromShape(plantShape),
            plantId: plantShape.props.plantId,
            x: plantShape.x - bedBounds.x,
            y: plantShape.y - bedBounds.y,
            plantedDate: plantShape.props.plantedDate
              ? new Date(plantShape.props.plantedDate)
              : undefined,
          })
        }
      }

      const points = placeBedPoints(
        this.parsePoints(bedShape.props.pointsJson),
        bedShape.x,
        bedShape.y,
        bedShape.props.w,
        bedShape.props.h,
      )

      // Convert back to GardenBed
      const bed: GardenBed = {
        id: bedId,
        name: bedShape.props.name,
        points,
        fill: (bedShape.meta as { originalFill?: string })?.originalFill || '#e0f2e0',
        stroke: bedShape.props.color,
        plants: bedPlants,
        width: bedShape.props.w,
        height: bedShape.props.h,
        rotation: bedShape.rotation,
        elementType: bedShape.props.elementType || undefined,
        elementCategory: (bedShape.props.elementCategory as any) || undefined,
        zone: bedShape.props.zone >= 0 ? (bedShape.props.zone as any) : undefined,
        metadata: this.parseJson<Record<string, unknown>>((bedShape.meta as any)?.metadataJson),
      }

      beds.push(bed)
    }

    // Placed elements are canvas shapes of their own type. Without this they
    // were dropped on the way back to GardenBed[], so a pond the user placed
    // disappeared at the next autosave and never reached the plan.
    const elementShapes = shapes.filter(s => s.type === 'element') as ElementShape[]
    for (const elementShape of elementShapes) {
      const points = placeBedPoints(
        this.parsePoints(elementShape.props.pointsJson),
        elementShape.x,
        elementShape.y,
        elementShape.props.w,
        elementShape.props.h,
      )

      beds.push({
        id: gardenIdFromShape(elementShape),
        name: elementShape.props.name,
        points,
        fill: elementShape.props.fill,
        stroke: elementShape.props.color,
        plants: [],
        width: elementShape.props.w,
        height: elementShape.props.h,
        rotation: elementShape.rotation,
        elementType: elementShape.props.subtype,
        elementCategory: elementShape.props.category as GardenBed['elementCategory'],
        zone: elementShape.props.zone >= 0 ? (elementShape.props.zone as GardenBed['zone']) : undefined,
        metadata: this.parseJson<Record<string, unknown>>(elementShape.props.metadataJson) ?? undefined,
      })
    }

    return beds
  }

  // ========== Helper Methods ==========

  /**
   * Parse a JSON string a shape carries, treating corruption as absent.
   *
   * Shape meta is persisted in the tldraw document and round-trips through
   * save/load; one malformed blob used to throw inside shapesToGardenBeds and
   * leave the canvas empty, while the points blob beside it was already guarded.
   */
  private parseJson<T>(value: unknown): T | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }

  /**
   * Parse points from JSON string
   */
  private parsePoints(pointsJson: string): { x: number; y: number }[] {
    const points = this.parseJson<{ x: number; y: number }[]>(pointsJson)
    return Array.isArray(points) ? points : []
  }

  /**
   * Convert plant item to tldraw PlantShape
   */
  private plantToShape(
    plant: PlantedItem,
    bed: GardenBed,
    spot: { x: number; y: number; radius: number; fontSize: number },
    labelMaxWidth: number,
  ): PlantShape {
    const info = getPlantById(plant.plantId)
    return {
      id: createShapeId(plant.id),
      type: 'plant',
      x: this.getBedX(bed.points) + spot.x,
      y: this.getBedY(bed.points) + spot.y,
      rotation: 0,
      isLocked: false,
      opacity: 1,
      props: {
        radius: spot.radius,
        plantId: plant.plantId,
        plantName: this.getPlantName(plant.plantId),
        emoji: this.getPlantEmoji(plant.plantId),
        color: '#22c55e',
        // Real relationships from the library. These were hardcoded to '[]',
        // which made every loaded plant report itself compatible with
        // everything -- isCompatibleWith on a reloaded canvas could never
        // return false. plant-tool.ts already looked them up correctly, so
        // only the load path was blind.
        companionsJson: JSON.stringify(info?.companions ?? []),
        antagonistsJson: JSON.stringify(info?.antagonists ?? []),
        // Prefer the library's mature spacing over the flat 12in default.
        spacing: info?.size.spacing ?? 12,
        plantedDate: plant.plantedDate?.toISOString() || '',
      },
      meta: {
        bedId: bed.id,
        fontSize: spot.fontSize,
        labelMaxWidth,
      },
      parentId: 'page:page' as any,
      index: 'a1' as any,
      typeName: 'shape',
    }
  }

  /**
   * Get the minimum X coordinate from points
   */
  /** Rebuild an element shape from a saved element bed. */
  private elementToShape(bed: GardenBed): ElementShape {
    const subtype = (bed.elementType || 'raised_bed') as ElementSubtype
    const style = ELEMENT_STYLES[subtype] ?? ELEMENT_STYLES.raised_bed

    return {
      id: createShapeId(bed.id),
      type: 'element',
      x: this.getBedX(bed.points),
      y: this.getBedY(bed.points),
      rotation: bed.rotation || 0,
      isLocked: false,
      opacity: 1,
      props: {
        w: bed.width || this.calculateWidth(bed.points),
        h: bed.height || this.calculateHeight(bed.points),
        name: bed.name,
        subtype,
        category: bed.elementCategory || 'bed',
        color: bed.stroke || style.defaultStroke,
        fill: bed.fill || style.defaultFill,
        pointsJson:
          bed.points && bed.points.length > 2
            ? JSON.stringify(this.normalizePoints(bed.points))
            : '[]',
        zone: bed.zone ?? -1,
        capacity: Number(bed.metadata?.capacity ?? 0) || 0,
        material: typeof bed.metadata?.material === 'string' ? bed.metadata.material : '',
        flowDirection: '',
        connectedIds: '[]',
        metadataJson: bed.metadata ? JSON.stringify(bed.metadata) : '{}',
      },
      meta: { gardenId: bed.id },
      parentId: 'page:page' as any,
      index: 'a1' as any,
      typeName: 'shape',
    } as ElementShape
  }

  private getBedX(points: { x: number; y: number }[]): number {
    if (!points || points.length === 0) return 0
    return Math.min(...points.map(p => p.x))
  }

  /**
   * Get the minimum Y coordinate from points
   */
  private getBedY(points: { x: number; y: number }[]): number {
    if (!points || points.length === 0) return 0
    return Math.min(...points.map(p => p.y))
  }

  /**
   * Calculate width from points array
   */
  private calculateWidth(points: { x: number; y: number }[]): number {
    if (!points || points.length === 0) return 200
    const xs = points.map(p => p.x)
    return Math.max(...xs) - Math.min(...xs)
  }

  /**
   * Calculate height from points array
   */
  private calculateHeight(points: { x: number; y: number }[]): number {
    if (!points || points.length === 0) return 100
    const ys = points.map(p => p.y)
    return Math.max(...ys) - Math.min(...ys)
  }

  /**
   * Normalize points to be relative to shape's origin (0, 0)
   * This is required for tldraw's coordinate system
   */
  private normalizePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    const minX = Math.min(...points.map(p => p.x))
    const minY = Math.min(...points.map(p => p.y))

    return points.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
    }))
  }

  /**
   * Get bounding box of a bed shape
   */
  private getShapeBounds(shape: BedShape) {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.props.w,
      height: shape.props.h,
    }
  }

  /**
   * Check if plant is spatially within bed bounds
   */
  private isPlantInBed(
    plant: PlantShape,
    bedBounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      plant.x >= bedBounds.x &&
      plant.x <= bedBounds.x + bedBounds.width &&
      plant.y >= bedBounds.y &&
      plant.y <= bedBounds.y + bedBounds.height
    )
  }

  /**
   * Get human-readable plant name from ID.
   *
   * The library is authoritative and all 50 entries carry a proper display name;
   * the id-derived fallback only applies to a plant the library does not know.
   */
  private getPlantName(plantId: string): string {
    const info = getPlantById(plantId)
    if (info) return info.name

    // Capitalize and format plant ID as name
    return plantId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Get emoji for plant based on ID.
   *
   * Was a hand-maintained 20-entry map that matched by substring, so the 30
   * plants it did not list -- squash, all the berries, the herbs and flowers --
   * every rendered as the same generic seedling. Every library entry has an
   * icon, so look that up and only fall back to a guess for an unknown id.
   */
  private getPlantEmoji(plantId: string): string {
    const info = getPlantById(plantId)
    if (info?.icon) return info.icon

    // Substring match for an id the library does not have, e.g. a crop id that
    // is not in the plant library but shares a name with one.
    const lowerPlantId = plantId.toLowerCase()
    for (const plant of PLANT_LIBRARY) {
      if (lowerPlantId.includes(plant.id) || plant.id.includes(lowerPlantId)) {
        return plant.icon
      }
    }

    return '🌱' // Default plant emoji
  }
}

/**
 * Singleton instance for easy importing
 *
 * Usage:
 * ```ts
 * import { dataAdapter } from '@/components/tldraw/data-adapter'
 *
 * const shapes = dataAdapter.gardenBedsToShapes(myBeds)
 * const beds = dataAdapter.shapesToGardenBeds(myShapes)
 * ```
 */
export const dataAdapter = new DataAdapter()
