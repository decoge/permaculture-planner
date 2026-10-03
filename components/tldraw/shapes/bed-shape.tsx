import {
  BaseBoxShapeUtil,
  TLBaseShape,
  TLResizeInfo,
  RecordProps,
  T,
  Rectangle2d,
  Geometry2d,
  Polygon2d,
  SVGContainer,
  Vec,
  resizeBox,
} from 'tldraw'
import { scalePointsToSize } from '@/lib/garden/bed-geometry'

/**
 * Point structure for bed polygons
 */
interface Point {
  x: number
  y: number
}

function bedTitle(name: string, zone: number): string {
  return zone >= 0 ? `Z${zone} ${name}` : name
}

function bedTitleSize(title: string, width: number): number {
  const available = Math.max(width - 8, 12)
  const fitted = available / Math.max(title.length * 0.56, 1)
  return Math.max(5, Math.min(11, fitted))
}

/**
 * BedShape represents garden beds and permaculture elements
 * Supports both rectangular and custom polygon shapes
 */
export type BedShape = TLBaseShape<
  'bed',
  {
    w: number
    h: number
    name: string
    color: string
    // Using string to store JSON-serialized points for tldraw compatibility
    pointsJson: string // JSON.stringify(Point[])
    elementType: string
    elementCategory: string
    zone: number
  }
>

export class BedShapeUtil extends BaseBoxShapeUtil<BedShape> {
  static override type = 'bed' as const

  /**
   * Define shape properties with proper validators
   * Using simple types that tldraw can properly validate
   */
  static override props: RecordProps<BedShape> = {
    w: T.number,
    h: T.number,
    name: T.string,
    color: T.string,
    pointsJson: T.string,
    elementType: T.string,
    elementCategory: T.string,
    zone: T.number,
  }

  /**
   * Default properties for new bed shapes
   */
  getDefaultProps(): BedShape['props'] {
    return {
      w: 200,
      h: 100,
      name: 'Garden Bed',
      color: '#22c55e',
      pointsJson: '[]', // Empty array = use rectangle
      elementType: '',
      elementCategory: 'bed',
      zone: -1, // -1 = no zone assigned
    }
  }

  override onResize(shape: BedShape, info: TLResizeInfo<BedShape>) {
    const resized = resizeBox(shape, info)
    const points = this.parsePoints(shape.props.pointsJson)
    if (points.length < 3) return resized

    return {
      ...resized,
      props: {
        ...resized.props,
        pointsJson: JSON.stringify(scalePointsToSize(points, resized.props.w, resized.props.h)),
      },
    }
  }

  /**
   * Parse points from JSON string
   */
  private parsePoints(pointsJson: string): Point[] {
    try {
      const points = JSON.parse(pointsJson)
      return Array.isArray(points) ? points : []
    } catch {
      return []
    }
  }

  /**
   * Get geometry for hit testing and bounds calculation
   */
  getGeometry(shape: BedShape): Geometry2d {
    const points = this.parsePoints(shape.props.pointsJson)

    // If custom points are defined, use polygon geometry
    if (points.length > 2) {
      // Convert to Vec format for tldraw
      const vecPoints = points.map(p => new Vec(p.x, p.y))
      return new Polygon2d({
        points: vecPoints,
        isFilled: true,
      })
    }

    // Otherwise use rectangle
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  /**
   * Render the bed shape as SVG
   */
  component(shape: BedShape) {
    const { w, h, name, color, pointsJson, zone, elementCategory } = shape.props
    const points = this.parsePoints(pointsJson)

    // Determine fill based on element category
    const fillColor = this.getCategoryColor(elementCategory, color)
    const strokeColor = color
    const title = bedTitle(name, zone)
    const titleSize = bedTitleSize(title, w)

    if (points.length > 2) {
      // Render as polygon
      const pathData = this.pointsToPath(points)

      return (
        <SVGContainer>
          <path
            d={pathData}
            fill={fillColor}
            fillOpacity={0.3}
            stroke={strokeColor}
            strokeWidth={2}
          />
          <text
            x={4}
            y={titleSize + 2}
            fill="currentColor"
            fontSize={titleSize}
            fontWeight="600"
            textLength={Math.max(w - 8, 12)}
            lengthAdjust="spacingAndGlyphs"
          >
            {title}
          </text>
        </SVGContainer>
      )
    }

    // Render as rectangle
    return (
      <SVGContainer>
        <rect
          width={w}
          height={h}
          fill={fillColor}
          fillOpacity={0.3}
          stroke={strokeColor}
          strokeWidth={2}
          rx={4}
          ry={4}
        />
        <text
          x={4}
          y={titleSize + 2}
          fill="currentColor"
          fontSize={titleSize}
          fontWeight="600"
          textLength={Math.max(w - 8, 12)}
          lengthAdjust="spacingAndGlyphs"
        >
          {title}
        </text>
      </SVGContainer>
    )
  }

  override getIndicatorPath(shape: BedShape) {
    const { w, h, pointsJson } = shape.props
    const points = this.parsePoints(pointsJson)

    if (points.length > 2) {
      return new Path2D(this.pointsToPath(points))
    }

    const path = new Path2D()
    path.rect(0, 0, w, h)
    return path
  }

  /**
   * Convert points array to SVG path string
   */
  private pointsToPath(points: Point[]): string {
    if (points.length === 0) return ''

    const [first, ...rest] = points
    let path = `M ${first.x} ${first.y}`

    for (const point of rest) {
      path += ` L ${point.x} ${point.y}`
    }

    path += ' Z' // Close the path
    return path
  }

  /**
   * Get color based on element category
   * Color-codes different permaculture elements
   */
  private getCategoryColor(category: string, defaultColor: string): string {
    const categoryColors: Record<string, string> = {
      bed: '#22c55e',            // Green
      water_management: '#3b82f6', // Blue
      structure: '#8b5cf6',       // Purple
      access: '#64748b',          // Gray
      energy: '#eab308',          // Yellow
      animal: '#f59e0b',          // Orange
      waste: '#84cc16',           // Lime
    }

    return categoryColors[category] || defaultColor
  }
}
