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
  HTMLContainer,
  Vec,
  resizeBox,
} from 'tldraw'
import { scalePointsToSize } from '@/lib/garden/bed-geometry'
import { bedLabelWidth } from '@/lib/garden/plant-label-layout'
import { FittedSvgText } from '@/components/tldraw/fitted-svg-text'

/**
 * Point structure for bed polygons
 */
interface Point {
  x: number
  y: number
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
    const { w, h, name, color, pointsJson, elementCategory } = shape.props
    const points = this.parsePoints(pointsJson)

    // Determine fill based on element category
    const fillColor = this.getCategoryColor(elementCategory, color)
    const strokeColor = color
    const title = (
      <HTMLContainer>
        <FittedSvgText
          text={name}
          x={w / 2}
          y={3}
          maxWidth={bedLabelWidth(w)}
          maxSize={12}
          fontWeight={600}
          label="title"
        />
      </HTMLContainer>
    )

    if (points.length > 2) {
      const pathData = this.pointsToPath(points)

      return (
        <>
          <SVGContainer>
            <path
              d={pathData}
              fill={fillColor}
              fillOpacity={0.3}
              stroke={strokeColor}
              strokeWidth={2}
            />
          </SVGContainer>
          {title}
        </>
      )
    }

    return (
      <>
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
        </SVGContainer>
        {title}
      </>
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
