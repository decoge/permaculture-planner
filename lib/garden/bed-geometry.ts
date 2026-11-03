export interface BedPoint {
  x: number
  y: number
}

/**
 * Place stored bed points in page space.
 * Points may be relative to the shape origin. A resize updates width and height
 * while the stored polygon can still describe the previous size, so the polygon
 * is scaled only when the box has actually changed.
 */
export function placeBedPoints(
  points: BedPoint[],
  originX: number,
  originY: number,
  width: number,
  height: number,
): BedPoint[] {
  const w = Number.isFinite(width) && width > 0 ? width : 1
  const h = Number.isFinite(height) && height > 0 ? height : 1

  if (points.length === 0) {
    return [
      { x: originX, y: originY },
      { x: originX + w, y: originY },
      { x: originX + w, y: originY + h },
      { x: originX, y: originY + h },
    ]
  }

  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const srcW = Math.max(maxX - minX, 1)
  const srcH = Math.max(maxY - minY, 1)
  const scaleX = Math.abs(w - srcW) > 1 ? w / srcW : 1
  const scaleY = Math.abs(h - srcH) > 1 ? h / srcH : 1

  return points.map((point) => ({
    x: originX + (point.x - minX) * scaleX,
    y: originY + (point.y - minY) * scaleY,
  }))
}

/** Scale a polygon so it fills a width/height box whose origin is 0,0. */
export function scalePointsToSize(points: BedPoint[], width: number, height: number): BedPoint[] {
  if (points.length === 0) return []

  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const srcW = Math.max(maxX - minX, 1)
  const srcH = Math.max(maxY - minY, 1)
  const w = Number.isFinite(width) && width > 0 ? width : srcW
  const h = Number.isFinite(height) && height > 0 ? height : srcH

  return points.map((point) => ({
    x: ((point.x - minX) / srcW) * w,
    y: ((point.y - minY) / srcH) * h,
  }))
}

/** A bed's page-space box, which is what the save path uses to claim a plant. */
export interface BedBounds extends BedPoint {
  width: number
  height: number
}

/**
 * Whether a point falls inside a bed's box.
 *
 * The canvas-to-plan conversion only keeps a plant whose insertion point lies
 * inside a bed (`isPlantInBed` in `components/tldraw/data-adapter.ts`), and the
 * editor re-renders from that plan — so a plant dropped outside every bed looks
 * placed and then disappears on the next save. The plant tool asks this before
 * creating a shape, so the user is told instead of watching the plant vanish.
 * Includes the edges, exactly like the conversion it mirrors.
 */
export function boundsContainPoint(bounds: BedBounds, point: BedPoint): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/** The first bed (in draw order) whose box contains the point, if any. */
export function bedAtPoint(beds: BedBounds[], point: BedPoint): BedBounds | null {
  for (const bed of beds) {
    if (boundsContainPoint(bed, point)) return bed
  }
  return null
}
