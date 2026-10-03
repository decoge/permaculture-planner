import type { ElementSubtype } from '@/lib/canvas-elements'

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    bed: {
      w: number
      h: number
      name: string
      color: string
      pointsJson: string
      elementType: string
      elementCategory: string
      zone: number
    }
    plant: {
      radius: number
      plantId: string
      plantName: string
      emoji: string
      color: string
      companionsJson: string
      antagonistsJson: string
      spacing: number
      plantedDate: string
    }
    element: {
      w: number
      h: number
      name: string
      subtype: ElementSubtype
      category: string
      color: string
      fill: string
      pointsJson: string
      zone: number
      capacity: number
      material: string
      flowDirection: string
      connectedIds: string
      metadataJson: string
    }
    zone: {
      radius: number
      zoneNumber: 0 | 1 | 2 | 3 | 4 | 5
      color: string
      label: string
      description: string
      centerX: number
      centerY: number
    }
    'companion-line': {
      startX: number
      startY: number
      endX: number
      endY: number
      relationship: 'good' | 'bad' | 'neutral'
      plant1Id: string
      plant2Id: string
      plant1Name: string
      plant2Name: string
    }
  }
}

export {}
