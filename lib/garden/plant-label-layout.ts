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
  fontSize: number
}

export interface MarkBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** Wider than a typical glyph so fitted labels stay inside the bed. */
export const LABEL_CHAR_WIDTH = 0.7

const PAD = 6
const HEADER = 16

/** Width a centered label may use without crossing the bed stroke. */
export function bedLabelWidth(bedWidth: number): number {
  return Math.max(bedWidth - PAD * 2, 8)
}

export function estimateTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  return text.length * fontSize * LABEL_CHAR_WIDTH
}

/** Largest font whose estimated width fits in maxWidth. Never letter-spaces the text. */
export function fittedFontSize(text: string, maxWidth: number, maxSize = 12): number {
  const available = Math.max(maxWidth, 1)
  const fitted = available / Math.max(text.length * LABEL_CHAR_WIDTH, 1)
  return Math.min(maxSize, fitted)
}

/** Icon with the name centered underneath it. Coordinates are relative to the bed origin. */
export function plantMarkBounds(
  x: number,
  y: number,
  name: string,
  radius: number,
  fontSize: number,
): MarkBox {
  const textWidth = estimateTextWidth(name, fontSize)
  const halfWidth = Math.max(radius, textWidth / 2)
  return {
    left: x - halfWidth,
    top: y - radius,
    right: x + halfWidth,
    bottom: y + radius + 2 + fontSize,
  }
}

function boxesOverlap(a: MarkBox, b: MarkBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/**
 * Stack each plant in the middle of the bed.
 * The name font is limited by the bed width, so the label cannot hang out of the rectangle.
 */
export function placePlantsInBed(
  plants: PlantSpotInput[],
  bedWidth: number,
  bedHeight: number,
): PlantSpot[] {
  if (plants.length === 0) return []

  const width = Math.max(bedWidth, 16)
  const height = Math.max(bedHeight, 16)
  const innerWidth = bedLabelWidth(width)
  const innerHeight = Math.max(height - HEADER - 4, 8)
  const longest = plants.reduce((longestName, plant) => {
    return plant.name.length > longestName.length ? plant.name : longestName
  }, '')

  let fontSize = fittedFontSize(longest || 'Plant', innerWidth, 10)
  let radius = Math.min(6, Math.max(2.5, fontSize * 0.45))
  let rowPitch = radius * 2 + fontSize + 4

  while (plants.length * rowPitch > innerHeight && fontSize > 2) {
    fontSize = Math.min(fontSize, fittedFontSize(longest || 'Plant', innerWidth, fontSize - 0.25))
    radius = Math.min(6, Math.max(2, fontSize * 0.45))
    rowPitch = radius * 2 + fontSize + 3
  }

  if (plants.length * rowPitch > innerHeight) {
    rowPitch = innerHeight / plants.length
    fontSize = Math.min(fontSize, Math.max(2, rowPitch - radius * 2 - 3))
  }

  const x = width / 2
  return plants.map((plant, index) => ({
    id: plant.id,
    x,
    y: HEADER + radius + index * rowPitch,
    radius,
    fontSize,
  }))
}

export function plantMarksFit(
  spots: PlantSpot[],
  names: Map<string, string>,
  bedWidth: number,
  bedHeight: number,
): boolean {
  const boxes = spots.map((spot) => plantMarkBounds(
    spot.x,
    spot.y,
    names.get(spot.id) || '',
    spot.radius,
    spot.fontSize,
  ))
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i]
    if (box.left < 1 || box.top < 1 || box.right > bedWidth - 1 || box.bottom > bedHeight - 1) return false
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(box, boxes[j])) return false
    }
  }
  return true
}
