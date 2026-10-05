import horticultureRules from '@/lib/data/horticulture-rules.json'

export interface SiteConstraints {
  totalArea: number // sq ft
  usableFraction: number // 0-1
  shape: 'rectangular' | 'L-shaped' | 'scattered'
  surface: 'soil' | 'hard'
  waterAccess: 'spigot' | 'none' | 'rain'
  sunExposure: 'full' | 'partial' | 'mixed'
  slope: number // percent
  accessibilityNeeds?: boolean
  existingStructures?: Array<{ x: number; y: number; width: number; height: number }>
}

export interface BedLayout {
  id: string
  name: string
  x: number
  y: number
  width: number // feet
  length: number // feet
  height: number // inches
  orientation: 'NS' | 'EW'
  hasTrellis: boolean
  isWicking: boolean
  pathWidth: number // inches
}

export interface GeneratedLayout {
  beds: BedLayout[]
  totalBedArea: number
  totalPathArea: number
  efficiency: number // bed area / total area
  warnings: string[]
  suggestions: string[]
}

export class LayoutGenerator {
  private rules = horticultureRules

  generate(constraints: SiteConstraints): GeneratedLayout {
    // Guard the degenerate inputs before any division. `usableArea` is zero
    // when either factor is zero, and both `areaLength` (usableArea / areaWidth)
    // and `efficiency` (totalBedArea / usableArea) divide by it, so an unvalidated
    // caller gets Infinity/NaN out of a generator that is otherwise total.
    // /api/plans now validates the wizard payload first, but this class is
    // exported and the guards cost nothing.
    const totalArea = Number.isFinite(constraints.totalArea)
      ? Math.max(0, constraints.totalArea)
      : 0
    const usableFraction = Number.isFinite(constraints.usableFraction)
      ? Math.min(1, Math.max(0, constraints.usableFraction))
      : 1
    const usableArea = totalArea * usableFraction

    const warnings: string[] = []
    const suggestions: string[] = []

    // Determine bed dimensions based on accessibility
    const bedWidth = constraints.accessibilityNeeds ? 3 : 4 // feet
    const pathWidth = constraints.accessibilityNeeds ? 36 : 24 // inches
    const bedHeight = constraints.surface === 'hard' ? 12 : 10 // inches

    if (usableArea <= 0) {
      // Nothing can be laid out, and the warning is more use than a silent
      // empty result.
      warnings.push('No usable area: check the site area and usable fraction.')
      return {
        beds: [],
        totalBedArea: 0,
        totalPathArea: 0,
        efficiency: 0,
        warnings,
        suggestions,
      }
    }

    // Calculate available space dimensions (assuming rectangular for now)
    const areaWidth = Math.sqrt(usableArea * 1.5) // Assume 1.5:1 ratio
    const areaLength = usableArea / areaWidth
    
    // Generate beds
    const beds: BedLayout[] = []
    const bedLengthOptions = [8, 10, 12] // Common lumber sizes
    
    let currentX = 0
    let currentY = 0
    let bedCount = 0
    
    // Simple grid layout generation
    while (currentY + bedWidth + pathWidth/12 < areaLength) {
      currentX = 0
      
      while (currentX + bedWidth + pathWidth/12 < areaWidth) {
        const bedLength = this.selectBedLength(bedLengthOptions, areaWidth - currentX)
        
        if (bedLength > 0) {
          beds.push({
            id: `bed-${bedCount}`,
            name: `Bed ${bedCount + 1}`,
            x: currentX,
            y: currentY,
            width: bedWidth,
            length: bedLength,
            height: bedHeight,
            orientation: this.determineOrientation(constraints),
            hasTrellis: bedCount % 3 === 0, // Every third bed gets trellis
            isWicking: constraints.surface === 'hard' || constraints.waterAccess === 'none',
            pathWidth: pathWidth
          })
          
          bedCount++
          currentX += bedLength + pathWidth/12
        } else {
          break
        }
      }
      
      currentY += bedWidth + pathWidth/12
    }
    
    // Calculate areas
    const totalBedArea = beds.reduce((sum, bed) => sum + (bed.width * bed.length), 0)
    const totalPathArea = usableArea - totalBedArea
    
    // Add warnings and suggestions
    if (constraints.surface === 'hard') {
      suggestions.push('Consider wicking beds for water efficiency on hard surfaces')
      suggestions.push('Ensure adequate drainage to prevent surface staining')
      if (constraints.slope > 0) {
        warnings.push('Check structural load capacity for rooftop installations')
      }
    }
    
    if (constraints.sunExposure === 'partial') {
      suggestions.push('Focus on leafy greens and cool-season crops for partial shade areas')
    }
    
    if (constraints.waterAccess === 'none') {
      warnings.push('Consider rain barrel installation or hand-watering requirements')
      suggestions.push('Sub-irrigated planters (SIPs) recommended for water conservation')
    }
    
    if (beds.length < 2) {
      warnings.push('Limited space may restrict crop rotation options')
    }
    
    if (constraints.slope > 5) {
      warnings.push('Slope exceeds 5% - consider terracing or retaining walls')
    }
    
    return {
      beds,
      totalBedArea,
      totalPathArea,
      efficiency: totalBedArea / usableArea,
      warnings,
      suggestions
    }
  }
  
  private selectBedLength(options: number[], availableSpace: number): number {
    // Select the largest bed length that fits
    const sorted = options.sort((a, b) => b - a)
    for (const length of sorted) {
      if (length <= availableSpace - 2) { // Leave 2ft min for path
        return length
      }
    }
    // If no standard size fits, use available space minus path
    const customLength = Math.floor(availableSpace - 2)
    return customLength >= 4 ? customLength : 0 // Minimum 4ft bed
  }
  
  private determineOrientation(constraints: SiteConstraints): 'NS' | 'EW' {
    // Default to north-south for even lighting
    // East-west if frost mitigation is a concern (not implemented in v1)
    return 'NS'
  }
  
  optimizeLayout(layout: GeneratedLayout, preferences: any): GeneratedLayout {
    // Future enhancement: optimize based on user preferences
    // For now, return as-is
    return layout
  }
}