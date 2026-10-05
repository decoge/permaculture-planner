import {
  ShapeUtil,
  TLBaseShape,
  RecordProps,
  T,
  Circle2d,
  Geometry2d,
  SVGContainer,
  HTMLContainer,
} from 'tldraw'
import { FittedSvgText } from '@/components/tldraw/fitted-svg-text'

/**
 * PlantShape represents individual plants within garden beds
 * Includes companion planting information and spacing guides
 */
export type PlantShape = TLBaseShape<
  'plant',
  {
    radius: number
    plantId: string
    plantName: string
    emoji: string
    color: string
    // Using JSON strings for arrays to work with tldraw validators
    companionsJson: string // JSON.stringify(string[])
    antagonistsJson: string // JSON.stringify(string[])
    spacing: number // Required spacing in inches
    plantedDate: string // ISO date string
  }
>

export class PlantShapeUtil extends ShapeUtil<PlantShape> {
  static override type = 'plant' as const

  /**
   * Define shape properties with proper validators
   */
  static override props: RecordProps<PlantShape> = {
    radius: T.number,
    plantId: T.string,
    plantName: T.string,
    emoji: T.string,
    color: T.string,
    companionsJson: T.string,
    antagonistsJson: T.string,
    spacing: T.number,
    plantedDate: T.string,
  }

  /**
   * Default properties for new plant shapes
   */
  override getDefaultProps(): PlantShape['props'] {
    return {
      radius: 20,
      plantId: 'unknown',
      plantName: 'Plant',
      emoji: '🌱',
      color: '#22c55e',
      companionsJson: '[]',
      antagonistsJson: '[]',
      spacing: 12,
      plantedDate: '',
    }
  }

  /**
   * Parse companions from JSON string
   */
  private parseCompanions(json: string): string[] {
    try {
      const companions = JSON.parse(json)
      return Array.isArray(companions) ? companions : []
    } catch {
      return []
    }
  }

  /**
   * Get geometry for hit testing
   * Plants use circular geometry
   */
  override getGeometry(shape: PlantShape): Geometry2d {
    return new Circle2d({
      radius: shape.props.radius,
      isFilled: true,
    })
  }

  /**
   * Render the plant shape
   */
  component(shape: PlantShape) {
    const { radius, plantName, emoji, color } = shape.props
    const storedSize = shape.meta.fontSize
    const storedWidth = shape.meta.labelMaxWidth
    const maxSize = typeof storedSize === 'number' && storedSize > 0 ? storedSize : 10
    const maxWidth = typeof storedWidth === 'number' && storedWidth > 0
      ? storedWidth
      : Math.max(radius * 2, 8)

    return (
      <>
        <SVGContainer>
          <circle
            cx={0}
            cy={0}
            r={radius}
            fill={color}
            fillOpacity={0.9}
            stroke="#fff"
            strokeWidth={1}
          />

          {emoji && (
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(radius * 0.9, 3)}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {emoji}
            </text>
          )}
        </SVGContainer>
        <HTMLContainer>
          <FittedSvgText
            text={plantName}
            x={0}
            y={radius + 2}
            maxWidth={maxWidth}
            maxSize={maxSize}
            fontWeight={500}
            label="plant"
          />
        </HTMLContainer>
      </>
    )
  }

  override getIndicatorPath(shape: PlantShape) {
    const path = new Path2D()
    path.arc(0, 0, shape.props.radius, 0, Math.PI * 2)
    return path
  }

  /**
   * Prevent resizing plants (they have fixed spacing requirements)
   */
  override canResize = () => false

  /**
   * Check if this plant is compatible with another plant
   * Used for companion planting features
   *
   * Takes the props explicitly rather than reading `this.props`. A ShapeUtil is
   * a singleton per shape type, not per shape, so there is no instance state to
   * read -- the old private `props` getter returned getDefaultProps(), which
   * means both relationship lists were always empty and every pair compared
   * compatible.
   *
   * Antagonism is treated as a property of the pair, so both lists are
   * consulted. The library only declares one side for 25 relationships (corn
   * lists tomato, but tomato does not list corn), and an order-dependent check
   * would mean dragging one shape left instead of right changes the answer.
   */
  isCompatibleWith(
    self: Pick<PlantShape, 'props'>,
    other: Pick<PlantShape, 'props'>
  ): boolean {
    const selfAntagonists = this.parseCompanions(self.props.antagonistsJson)
    const otherAntagonists = this.parseCompanions(other.props.antagonistsJson)
    const companions = this.parseCompanions(self.props.companionsJson)
    const otherCompanions = this.parseCompanions(other.props.companionsJson)

    if (
      selfAntagonists.includes(other.props.plantId) ||
      otherAntagonists.includes(self.props.plantId)
    ) {
      return false
    }

    // Check if companion
    if (
      companions.includes(other.props.plantId) ||
      otherCompanions.includes(self.props.plantId)
    ) {
      return true
    }

    // Neutral by default
    return true
  }
}
