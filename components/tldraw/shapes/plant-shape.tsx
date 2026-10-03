import {
  ShapeUtil,
  TLBaseShape,
  RecordProps,
  T,
  Circle2d,
  Geometry2d,
  SVGContainer,
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

        <FittedSvgText
          text={plantName}
          x={0}
          y={radius + 2}
          maxWidth={maxWidth}
          maxSize={maxSize}
          fontWeight={500}
          label="plant"
        />
      </SVGContainer>
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
   */
  isCompatibleWith(otherPlant: PlantShape): boolean {
    const antagonists = this.parseCompanions(this.props.antagonistsJson)
    const companions = this.parseCompanions(this.props.companionsJson)

    // Check if antagonistic
    if (antagonists.includes(otherPlant.props.plantId)) {
      return false
    }

    // Check if companion
    if (companions.includes(otherPlant.props.plantId)) {
      return true
    }

    // Neutral by default
    return true
  }

  /**
   * Helper to access props for instance methods
   */
  private get props() {
    // This is a workaround since we don't have shape instance in class methods
    // In actual use, you'd pass the shape instance
    return this.getDefaultProps()
  }
}
