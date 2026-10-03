import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createWizardPlan } from '@/lib/db/wizard-plan'
import { LayoutGenerator } from '@/lib/algorithms/layout-generator'
import { MaterialsCalculator } from '@/lib/algorithms/materials-calculator'
import { CropRotationEngine } from '@/lib/algorithms/crop-rotation'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wizardData = await request.json()
    const layoutGenerator = new LayoutGenerator()
    const layout = layoutGenerator.generate({
      totalArea: wizardData.area.total_sqft,
      usableFraction: wizardData.area.usable_fraction,
      shape: wizardData.area.shape,
      surface: wizardData.surface.type,
      waterAccess: wizardData.water.source,
      sunExposure: wizardData.surface.sun_hours >= 6 ? 'full' : 'partial',
      slope: wizardData.surface.slope,
      accessibilityNeeds: wizardData.surface.accessibility_needs,
    })

    const materialsCalculator = new MaterialsCalculator()
    const materials = materialsCalculator.calculate(
      layout.beds,
      wizardData.surface.type,
      wizardData.water.drip_allowed
    )

    const rotationEngine = new CropRotationEngine()
    const currentSeason = getCurrentSeason()
    const currentYear = new Date().getFullYear()
    const rotation = rotationEngine.generateRotation({
      beds: layout.beds,
      startSeason: currentSeason,
      startYear: currentYear,
      seasonsToplan: 3,
      preferredCrops: wizardData.crops.focus,
      avoidFamilies: wizardData.crops.avoid_families,
      sunExposure: wizardData.surface.sun_hours >= 6 ? 'full' : 'partial',
      lastFrostDate: wizardData.location.last_frost ? new Date(wizardData.location.last_frost) : undefined,
      firstFrostDate: wizardData.location.first_frost ? new Date(wizardData.location.first_frost) : undefined,
    })

    const plantings = rotation.plantings.slice(0, 10).map((planting) => ({
      bedName: `Bed ${Number(planting.bedId.split('-')[1]) + 1}`,
      season: planting.season,
      year: planting.year,
      variety: planting.crops[0]?.name ?? null,
      spacingIn: planting.spacing,
      family: planting.family,
      daysToMaturity: planting.crops[0]?.days_to_maturity ?? null,
    }))

    const created = await createWizardPlan({
      userId: user.id,
      site: {
        name: `Garden Site - ${new Date().toLocaleDateString()}`,
        lat: wizardData.location.lat,
        lng: wizardData.location.lng,
        usdaZone: wizardData.location.usda_zone,
        lastFrost: wizardData.location.last_frost,
        firstFrost: wizardData.location.first_frost,
        surfaceType: wizardData.surface.type,
        slope: wizardData.surface.slope,
        shadeNotes: `${wizardData.surface.sun_hours} hours sun`,
        waterSource: wizardData.water.source,
        constraints: wizardData,
      },
      planName: `Plan v1 - ${new Date().toLocaleDateString()}`,
      beds: layout.beds.map((bed, index) => ({
        name: bed.name,
        lengthFt: bed.length,
        widthFt: bed.width,
        heightIn: bed.height,
        orientation: bed.orientation,
        surface: wizardData.surface.type,
        wicking: bed.isWicking,
        trellis: bed.hasTrellis,
        pathClearanceIn: bed.pathWidth,
        orderIndex: index,
      })),
      plantings,
      tasks: generateInitialTasks(),
      materials: {
        soilCuft: materials.soil.cubicFeet,
        compostCuft: materials.compost.cubicFeet,
        mulchCuft: materials.mulch.cubicFeet,
        lumberBoardFeet:
          materials.lumber.boards2x10x8 * 8 +
          materials.lumber.boards2x10x10 * 10 +
          materials.lumber.boards2x10x12 * 12,
        screws: materials.lumber.screws,
        dripLineFt: materials.irrigation.dripLineFt,
        emitters: materials.irrigation.emitters,
        rowCoverSqFt: materials.rowCover.coverSqFt,
        costCents: materials.estimated_cost.low * 100,
      },
    })

    return NextResponse.json({
      id: created.id,
      success: true,
      summary: {
        beds: layout.beds.length,
        totalArea: layout.totalBedArea,
        estimatedCost: materials.estimated_cost,
        warnings: layout.warnings,
        suggestions: layout.suggestions,
      },
    })
  } catch (error) {
    return routeError(error, 'Failed to create plan')
  }
}

function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function generateInitialTasks() {
  const today = new Date()
  const due = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
  return [
    { title: 'Purchase lumber and hardware', dueOn: due(3), category: 'build' },
    { title: 'Assemble raised beds', dueOn: due(7), category: 'build' },
    { title: 'Fill beds with soil mix', dueOn: due(10), category: 'build' },
    { title: 'Install drip irrigation', dueOn: due(14), category: 'build' },
    { title: 'Plant first crops', dueOn: due(21), category: 'plant' },
  ]
}
