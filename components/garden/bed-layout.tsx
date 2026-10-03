export interface LayoutPoint {
  x: number
  y: number
}

export interface LayoutPlant {
  id?: string
  name?: string | null
  x?: number
  y?: number
}

export interface LayoutBedInput {
  id: string
  name: string
  length_ft?: number | null
  width_ft?: number | null
  notes?: string | Record<string, unknown> | null
  points?: LayoutPoint[]
  fill?: string
  stroke?: string
  plants?: LayoutPlant[]
  plantings?: Array<{
    id?: string
    variety?: string | null
    successions_json?: { position?: LayoutPoint } | string | null
  }>
}

interface PlacedBed {
  bed: LayoutBedInput
  points: LayoutPoint[]
  fill: string
  stroke: string
  plants: LayoutPlant[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return null
}

function isPoint(value: unknown): value is LayoutPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as LayoutPoint
  return typeof point.x === 'number' && typeof point.y === 'number'
}

function pointsFrom(bed: LayoutBedInput): LayoutPoint[] {
  if (bed.points && bed.points.length > 1) return bed.points
  const notes = asRecord(bed.notes)
  const raw = notes?.points
  if (!Array.isArray(raw)) return []
  return raw.filter(isPoint)
}

function plantLabel(name: string | null | undefined): string {
  if (!name) return 'Plant'
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function plantsFrom(bed: LayoutBedInput): LayoutPlant[] {
  if (bed.plants && bed.plants.length > 0) return bed.plants
  return (bed.plantings || []).map((planting) => {
    const stored = asRecord(planting.successions_json)
    const position = stored?.position
    const point = isPoint(position) ? position : undefined
    return {
      id: planting.id,
      name: planting.variety,
      x: point?.x,
      y: point?.y,
    }
  })
}

function placeBeds(beds: LayoutBedInput[]): PlacedBed[] {
  let cursorX = 24
  let cursorY = 24
  let rowHeight = 0

  return beds.map((bed) => {
    const notes = asRecord(bed.notes)
    const fill = bed.fill || (typeof notes?.fill === 'string' ? notes.fill : '#dcfce7')
    const stroke = bed.stroke || (typeof notes?.stroke === 'string' ? notes.stroke : '#16a34a')
    const plants = plantsFrom(bed)
    const existing = pointsFrom(bed)

    if (existing.length > 1) {
      return { bed, points: existing, fill, stroke, plants }
    }

    const width = Math.max(48, Number(bed.length_ft || 4) * 12)
    const height = Math.max(36, Number(bed.width_ft || 4) * 12)
    if (cursorX + width > 760) {
      cursorX = 24
      cursorY += rowHeight + 28
      rowHeight = 0
    }
    const points = [
      { x: cursorX, y: cursorY },
      { x: cursorX + width, y: cursorY },
      { x: cursorX + width, y: cursorY + height },
      { x: cursorX, y: cursorY + height },
    ]
    cursorX += width + 28
    rowHeight = Math.max(rowHeight, height)
    return { bed, points, fill, stroke, plants }
  })
}

export function BedLayout({
  beds,
  compact = false,
  className = '',
}: {
  beds: LayoutBedInput[]
  compact?: boolean
  className?: string
}) {
  if (beds.length === 0) {
    return (
      <div className={`flex h-full min-h-32 items-center justify-center text-sm text-gray-500 ${className}`}>
        No beds in this plan yet
      </div>
    )
  }

  const placed = placeBeds(beds)
  const allPoints = placed.flatMap((item) => item.points)
  const minX = Math.min(...allPoints.map((point) => point.x)) - 16
  const minY = Math.min(...allPoints.map((point) => point.y)) - 16
  const maxX = Math.max(...allPoints.map((point) => point.x)) + 16
  const maxY = Math.max(...allPoints.map((point) => point.y)) + 16

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <svg
        viewBox={`${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`}
        className="min-h-0 w-full flex-1 bg-emerald-50/70"
        role="img"
        aria-label="Garden bed layout"
      >
        {placed.map((item) => {
          const origin = item.points[0]
          const path = item.points.map((point) => `${point.x},${point.y}`).join(' ')
          const width = Math.abs((item.points[1]?.x ?? origin.x) - origin.x)
          return (
            <g key={item.bed.id}>
              <polygon points={path} fill={item.fill} stroke={item.stroke} strokeWidth={3} />
              {!compact && width > 70 && (
                <text x={origin.x + 8} y={origin.y + 18} fill="#14532d" fontSize={12} fontWeight={600}>
                  {item.bed.name}
                </text>
              )}
              {(compact ? [] : item.plants.slice(0, 8)).map((plant, index) => {
                const x = origin.x + (plant.x ?? 18 + (index % 4) * 16)
                const y = origin.y + (plant.y ?? 28 + Math.floor(index / 4) * 16)
                return <circle key={plant.id || `${item.bed.id}-${index}`} cx={x} cy={y} r={5} fill="#15803d" />
              })}
            </g>
          )
        })}
      </svg>
      {!compact && (
        <ul className="grid gap-1 border-t bg-white px-3 py-2 text-xs text-gray-700 sm:grid-cols-2">
          {placed.map((item) => {
            const names = [...new Set(item.plants.map((plant) => plantLabel(plant.name)))]
            return (
              <li key={`${item.bed.id}-caption`}>
                <span className="font-medium text-gray-900">{item.bed.name}:</span>{' '}
                {names.length > 0 ? names.join(', ') : 'No plants yet'}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
