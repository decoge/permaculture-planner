import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createWizardPlan } from '@/lib/db/wizard-plan'
import { LayoutGenerator } from '@/lib/algorithms/layout-generator'
import { MaterialsCalculator } from '@/lib/algorithms/materials-calculator'
import { CropRotationEngine } from '@/lib/algorithms/crop-rotation'

/**
 * The wizard's sun hours as a band, on the same thresholds the rest of the app
 * uses: 6+ hours is full sun, 3-5 partial, under 3 shade. The old mapping had
 * only two bands, so a one-hour courtyard was classed "partial" and the
 * rotation engine recommended full-sun crops for it.
 */
function sunBand(hours: number): 'full' | 'partial' | 'shade' {
  if (hours >= 6) return 'full'
  if (hours >= 3) return 'partial'
  return 'shade'
}
import { routeError } from '@/lib/api/route-error'
import { validateData, wizardDataSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // The wizard payload feeds the layout generator, the materials calculator and
    // the rotation engine. Validated here rather than at each call site because
    // every one of them indexes into nested fields: a missing or mistyped
    // `area` threw a TypeError and surfaced as a 500 instead of a 400.
    const parsed = validateData(wizardDataSchema, await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid wizard data', issues: parsed.errors.issues },
        { status: 400 }
      )
    }
    const wizardData = parsed.data

    const layoutGenerator = new LayoutGenerator()
    const layout = layoutGenerator.generate({
      totalArea: wizardData.area.total_sqft,
      usableFraction: wizardData.area.usable_fraction,
      shape: wizardData.area.shape,
      surface: wizardData.surface.type,
      waterAccess: wizardData.water.source,
      sunExposure: (wizardData.surface.sun_hours >= 6 ? 'full' : 'partial'),
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
      sunExposure: sunBand(wizardData.surface.sun_hours),
      lastFrostDate: wizardData.location.last_frost ? new Date(wizardData.location.last_frost) : undefined,
      firstFrostDate: wizardData.location.first_frost ? new Date(wizardData.location.first_frost) : undefined,
    })

    // The rotation engine emits one planting per bed per season, in bed order.
    // Cap per bed rather than slicing the flat list, so a plan with many beds
    // loses later seasons instead of silently losing whole beds -- every saved
    // bed then carries the crops it was actually planned for.
    const MAX_PLANTINGS_PER_BED = 3
    const perBedCount = new Map<string, number>()
    const plantings = rotation.plantings
      .filter((planting) => {
        const seen = perBedCount.get(planting.bedId) ?? 0
        if (seen >= MAX_PLANTINGS_PER_BED) return false
        perBedCount.set(planting.bedId, seen + 1)
        return true
      })
      .map((planting) => ({
        // Resolve the name from the layout that produced the bed id instead of
        // re-deriving it from the id string: the two could disagree, and a
        // non-numeric id produced a NaN name that then failed to match any bed.
        bedName: layout.beds.find((bed) => bed.id === planting.bedId)?.name ?? planting.bedId,
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
