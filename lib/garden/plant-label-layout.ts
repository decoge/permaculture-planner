export interface PlantSpotInput {
  id: string
  name: string
  x: number
  y: number
}

export interface PlantSpot {
  id: string
  x: number
  y: number
  radius: number
}

export interface MarkBox {
  left: number
  top: number
  right: number
  bottom: number
}

const MIN_RADIUS = 5
const MAX_RADIUS = 9
const LABEL_GAP = 2
const BOX_GAP = 2
const PAD = 4
const HEADER = 16

/** Font size used for the name drawn beside a plant icon. */
export function fontSizeForRadius(radius: number): number {
  return Math.max(8, Math.min(11, radius + 2))
}

export function estimateTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  return text.length * fontSize * 0.58
}

/** Icon with the name centered underneath it. Coordinates are relative to the bed origin. */
export function plantMarkBounds(x: number, y: number, name: string, radius: number): MarkBox {
  const fontSize = fontSizeForRadius(radius)
  const textWidth = estimateTextWidth(name, fontSize)
  const halfWidth = Math.max(radius, textWidth / 2)
  return {
    left: x - halfWidth,
    top: y - radius,
    right: x + halfWidth,
    bottom: y + radius + (textWidth > 0 ? LABEL_GAP + fontSize : 0),
  }
}

function boxesOverlap(a: MarkBox, b: MarkBox): boolean {
  return a.left < b.right + BOX_GAP
    && a.right + BOX_GAP > b.left
    && a.top < b.bottom + BOX_GAP
    && a.bottom + BOX_GAP > b.top
}

function marksCollide(plants: PlantSpotInput[], radius: number): boolean {
  const boxes = plants.map((plant) => plantMarkBounds(plant.x, plant.y, plant.name, radius))
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(boxes[i], boxes[j])) return true
    }
  }
  return false
}

function insideBed(plants: PlantSpotInput[], radius: number, bedWidth: number, bedHeight: number): boolean {
  return plants.every((plant) => {
    const box = plantMarkBounds(plant.x, plant.y, plant.name, radius)
    return box.left >= 0
      && box.top >= HEADER - 6
      && box.bottom <= bedHeight + 2
      && box.right <= bedWidth + 2
  })
}

function packPlants(
  plants: PlantSpotInput[],
  bedWidth: number,
  bedHeight: number,
  radius: number,
  allowOverflow: boolean,
): PlantSpot[] | null {
  const fontSize = fontSizeForRadius(radius)
  const maxLabel = Math.max(...plants.map((plant) => estimateTextWidth(plant.name || 'Plant', fontSize)), fontSize)
  const cellWidth = Math.max(radius * 2, maxLabel) + PAD
  const rowPitch = radius * 2 + LABEL_GAP + fontSize + BOX_GAP
  const usableWidth = Math.max(bedWidth - PAD * 2, 8)
  const usableHeight = Math.max(bedHeight - HEADER - PAD, rowPitch)

  let columns = Math.floor(usableWidth / cellWidth)
  if (columns < 1) columns = 1
  columns = Math.min(columns, plants.length)
  if (!allowOverflow && cellWidth > usableWidth + 12) return null

  const rows = Math.ceil(plants.length / columns)
  if (!allowOverflow && rows * rowPitch > usableHeight) return null

  const gridWidth = columns * cellWidth
  const originX = PAD + Math.max(0, (usableWidth - gridWidth) / 2)
  const originY = HEADER

  return plants.map((plant, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return {
      id: plant.id,
      x: originX + column * cellWidth + radius,
      y: originY + row * rowPitch + Math.max(radius, fontSize / 2),
      radius,
    }
  })
}

/**
 * Keep each plant's saved spot when its icon and name fit.
 * Otherwise stack the plants in the bed so the names do not cover each other.
 */
export function placePlantsInBed(
  plants: PlantSpotInput[],
  bedWidth: number,
  bedHeight: number,
): PlantSpot[] {
  if (plants.length === 0) return []

  const width = Math.max(bedWidth, 24)
  const height = Math.max(bedHeight, 24)

  for (let radius = MAX_RADIUS; radius >= MIN_RADIUS; radius -= 1) {
    if (!marksCollide(plants, radius) && insideBed(plants, radius, width, height)) {
      return plants.map((plant) => ({ id: plant.id, x: plant.x, y: plant.y, radius }))
    }
  }

  for (let radius = MAX_RADIUS; radius >= MIN_RADIUS; radius -= 1) {
    const packed = packPlants(plants, width, height, radius, false)
    if (!packed) continue
    const placed = packed.map((spot) => {
      const plant = plants.find((item) => item.id === spot.id)
      return { id: spot.id, name: plant?.name || '', x: spot.x, y: spot.y }
    })
    if (!marksCollide(placed, radius)) return packed
  }

  const fallbackRadius = MIN_RADIUS
  return packPlants(plants, width, height, fallbackRadius, true) || plants.map((plant) => ({
    id: plant.id,
    x: plant.x,
    y: plant.y,
    radius: fallbackRadius,
  }))
}
