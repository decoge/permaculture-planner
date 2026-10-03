'use client'

import { WizardData } from '@/app/wizard/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BedLayout } from '@/components/garden/bed-layout'
import { wizardService } from '@/lib/wizard/wizard-service'
import { CheckCircle2, MapPin, Square, Sun, Droplets, Leaf } from 'lucide-react'

interface ReviewStepProps {
  data: WizardData
  updateData: (section: keyof WizardData, data: any) => void
}

export function ReviewStep({ data }: ReviewStepProps) {
  const preview = wizardService.generateGardenFromWizard(data)
  const layoutBeds = preview.map((bed) => ({
    id: bed.id,
    name: bed.name,
    points: bed.points,
    fill: bed.fill,
    stroke: bed.stroke,
    plants: bed.plants?.map((plant) => ({
      id: plant.id,
      name: plant.plantId,
      x: plant.x,
      y: plant.y,
    })),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Review Your Plan</h2>
        <p className="text-gray-600 mb-6">
          This is the bed layout that will be saved. Generate the plan to keep it on your dashboard.
        </p>
      </div>

      <div className="h-72 rounded-lg border bg-white">
        <BedLayout beds={layoutBeds} />
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <div>{data.location.city || 'Not specified'}</div>
            <div>Zone {data.location.usda_zone || 'Not specified'}</div>
            <div>Last frost: {data.location.last_frost || 'Not specified'}</div>
            <div>First frost: {data.location.first_frost || 'Not specified'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Square className="h-4 w-4 mr-2" />
              Space
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <div>{data.area.total_sqft} sq ft total</div>
            <div>{Math.round(data.area.total_sqft * data.area.usable_fraction)} sq ft usable</div>
            <div>{data.area.shape} layout</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Sun className="h-4 w-4 mr-2" />
              Growing Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <div>Surface: {data.surface.type === 'soil' ? 'Soil/Ground' : 'Hard surface'}</div>
            <div>Sun exposure: {data.surface.sun_hours} hours/day</div>
            <div>Slope: {data.surface.slope}%</div>
            {data.surface.accessibility_needs && <div>✓ Accessibility features</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Droplets className="h-4 w-4 mr-2" />
              Water & Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <div>Water: {data.water.source}</div>
            {data.water.drip_allowed && <div>✓ Drip irrigation</div>}
            {data.water.sip_interest && <div>✓ Wicking beds</div>}
            <div>Lumber: {data.materials?.lumber_type || 'cedar'}</div>
            <div>Budget: {data.materials?.budget_tier || 'standard'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Leaf className="h-4 w-4 mr-2" />
              Crops
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <div>Focus: {data.crops.focus?.join(', ') || 'Not selected'}</div>
            <div>Time: {data.crops.time_weekly_minutes} min/week</div>
            {data.crops.avoid_families && data.crops.avoid_families.length > 0 && (
              <div>Avoiding: {data.crops.avoid_families.join(', ')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-green-900">Ready to save this layout</p>
            <p className="text-green-700 mt-1">
              {preview.length} beds will be saved with suggested plants for your crop focus. You can adjust the layout after it is saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}