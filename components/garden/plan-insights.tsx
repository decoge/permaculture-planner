'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFeet, PlanSummary, sunLabel } from '@/lib/garden/plan-summary'

export function PlanInsights({ summary }: { summary: PlanSummary }) {
  const companions = summary.relationships.filter((note) => note.relation === 'companion')
  const antagonists = summary.relationships.filter((note) => note.relation === 'antagonist')

  return (
    <div className="space-y-4">
      <Card data-plan-panel="design">
        <CardHeader>
          <CardTitle>Holistic Design Score</CardTitle>
          <CardDescription>
            Counted from the saved beds and plantings. This is not a design score.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            {summary.bedCount} beds, {formatFeet(summary.areaSqFt)} sq ft, {summary.plantCount} plantings, {summary.species.length} species.
          </p>
          {summary.beds.length === 0 ? <p>No beds are saved on this plan.</p> : null}
          {summary.beds.map((bed) => (
            <div key={bed.name}>
              <p className="font-medium text-gray-900">
                {bed.name}: {formatFeet(bed.lengthFt)} ft × {formatFeet(bed.widthFt)} ft
              </p>
              {bed.plants.length === 0 ? (
                <p>No plants saved in this bed.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {bed.plants.map((plant, index) => (
                    <li key={`${bed.name}-${plant.name}-${index}`}>
                      {plant.name}: {plant.sun ? sunLabel(plant.sun) : 'sun not recorded'}
                      {plant.spacingIn ? `, ${plant.spacingIn} in spacing` : ', spacing not recorded'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-plan-panel="ethics">
        <CardHeader>
          <CardTitle>Permaculture Ethics</CardTitle>
          <CardDescription>Read from the plants saved in each bed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            Earth care: {summary.species.length} species across {summary.bedCount} beds.
            {companions.length > 0
              ? ` Companion pairs: ${companions.map((note) => `${note.plantA} with ${note.plantB} in ${note.bedName}`).join('; ')}.`
              : ' No companion pairs from the plant library share a bed.'}
            {antagonists.length > 0
              ? ` Antagonist pairs: ${antagonists.map((note) => `${note.plantA} with ${note.plantB} in ${note.bedName}`).join('; ')}.`
              : ' No antagonist pairs share a bed.'}
          </p>
          <p>
            {summary.plantCount > 0
              ? `People care: the plan grows ${summary.species.join(', ')}.`
              : 'People care: no plants are saved on this plan.'}
          </p>
          <p>Fair share: this plan does not record shared harvest, seed saving, or community use.</p>
        </CardContent>
      </Card>

      <Card data-plan-panel="metrics">
        <CardHeader>
          <CardTitle>Scientific Metrics</CardTitle>
          <CardDescription>Sun and spacing from the plant library and saved positions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <ul className="space-y-1">
            <li>Full sun: {summary.sunCounts.full}</li>
            <li>Partial sun: {summary.sunCounts.partial}</li>
            <li>Shade: {summary.sunCounts.shade}</li>
            {summary.sunCounts.unknown > 0 ? <li>Sun not recorded: {summary.sunCounts.unknown}</li> : null}
          </ul>
          {summary.spacingNotes.length === 0 ? (
            <p>Saved plant positions are not close enough to compare, or the plants are not in the library.</p>
          ) : (
            <ul className="space-y-2">
              {summary.spacingNotes.map((note) => (
                <li key={`${note.bedName}-${note.plantA}-${note.plantB}`}>
                  {note.plantA} and {note.plantB} in {note.bedName} are {note.apartIn} in apart,{' '}
                  {note.closerThanNeeded
                    ? `closer than the ${note.neededIn} in these plants need`
                    : `at least the ${note.neededIn} in these plants need`}
                  .
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
