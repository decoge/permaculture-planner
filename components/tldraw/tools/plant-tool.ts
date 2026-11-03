import { StateNode, TLClickEvent, TLPointerEvent } from 'tldraw'
import { toast } from 'sonner'
import { PlantShape } from '../shapes/plant-shape'
import { bedAtPoint, type BedBounds } from '@/lib/garden/bed-geometry'
import { PlantInfo } from '@/lib/data/plant-library'

/**
 * PlantTool - Interactive tool for placing plants on canvas
 *
 * Usage:
 * 1. Select a plant from the library
 * 2. Click on a bed to place the plant
 * 3. Plant is automatically positioned with proper spacing
 *
 * A click outside every bed is refused rather than drawn: the canvas-to-plan
 * conversion only claims a plant whose insertion point falls inside a bed, so
 * such a plant used to appear and then vanish on the next save.
 */
export class PlantTool extends StateNode {
  static override id = 'plant-tool'

  private plantInfo: PlantInfo | null = null

  /**
   * Set the plant to be placed
   */
  setPlant(plant: PlantInfo) {
    this.plantInfo = plant
  }

  /**
   * Handle click to place plant
   */
  override onPointerDown: TLPointerEvent = (info) => {
    if (!this.plantInfo) return

    const { x, y } = this.editor.inputs.currentPagePoint

    if (!bedAtPoint(this.bedBounds(), { x, y })) {
      toast.info('Place plants inside a bed', {
        description: 'A plant dropped outside every bed is not kept in the plan.',
      })
      return
    }

    // Create plant shape at click location
    this.createPlantShape(x, y)
  }

  /** Page-space boxes of the beds on this page, in draw order. */
  private bedBounds(): BedBounds[] {
    return this.editor
      .getCurrentPageShapes()
      .filter((shape) => shape.type === 'bed')
      .map((shape) => {
        const props = shape.props as { w?: number; h?: number }
        return {
          x: shape.x,
          y: shape.y,
          width: props.w ?? 0,
          height: props.h ?? 0,
        }
      })
      .filter((bounds) => bounds.width > 0 && bounds.height > 0)
  }

  override onPointerMove: TLPointerEvent = () => {
    // Could show preview circle following cursor
  }

  override onCancel = () => {
    // Return to select tool
    this.editor.setCurrentTool('select')
  }

  private createPlantShape(x: number, y: number) {
    if (!this.plantInfo) return

    const plantId = `plant-${Date.now()}`
    const radius = Math.max(20, this.plantInfo.size.spacing / 2)

    this.editor.createShape<PlantShape>({
      type: 'plant',
      x,
      y,
      props: {
        radius,
        plantId: this.plantInfo.id,
        plantName: this.plantInfo.name,
        emoji: this.plantInfo.icon,
        color: this.plantInfo.color,
        companionsJson: JSON.stringify(this.plantInfo.companions),
        antagonistsJson: JSON.stringify(this.plantInfo.antagonists),
        spacing: this.plantInfo.size.spacing,
        plantedDate: new Date().toISOString(),
      },
    })

    // Stay in plant tool mode for placing multiple plants
    // Press Escape to return to select tool
  }
}
