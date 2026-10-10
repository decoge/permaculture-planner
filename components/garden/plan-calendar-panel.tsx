'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  harvestReadiness,
  seasonClock,
  type ReadinessInput,
  type ReadinessState,
} from '@/lib/garden/plan-calendar'
import { shoppingListFromEstimate, type StoredEstimate } from '@/lib/garden/shopping-list'

const STATE_BADGE: Record<ReadinessState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ready: { label: 'Ready', variant: 'default' },
  growing: { label: 'Growing', variant: 'secondary' },
  overdue: { label: 'Overdue', variant: 'destructive' },
  'not-recorded': { label: 'No sow date', variant: 'outline' },
  'unknown-crop': { label: 'Unknown crop', variant: 'outline' },
}

export interface PlanCalendarPlanting {
  id: string
  variety: string | null
  bedName: string
  sow_date: string | null
  target_days_to_maturity: number | null
}

export interface PlanCalendarPanelProps {
  plantings: PlanCalendarPlanting[]
  firstFrost: string | null
  lastFrost: string | null
  materialsEstimate: StoredEstimate | null
}

function varietyLabel(variety: string | null): string {
  if (!variety) return 'Unnamed planting'
  return variety.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PlanCalendarPanel({ plantings, firstFrost, lastFrost, materialsEstimate }: PlanCalendarPanelProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const clock = useMemo(
    () => seasonClock(firstFrost, lastFrost, today),
    [firstFrost, lastFrost, today]
  )

  const readinessRows = useMemo(() => {
    const inputs: ReadinessInput[] = plantings.map((planting) => ({
      plantingId: planting.id,
      label: `${varietyLabel(planting.variety)} · ${planting.bedName}`,
      sowDate: planting.sow_date,
      daysToMaturity: planting.target_days_to_maturity,
    }))
    const ORDER: ReadinessState[] = ['ready', 'overdue', 'growing', 'unknown-crop', 'not-recorded']
    return harvestReadiness(inputs, today).sort(
      (a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state)
    )
  }, [plantings, today])

  const shoppingList = useMemo(
    () => shoppingListFromEstimate(materialsEstimate),
    [materialsEstimate]
  )

  const readyCount = readinessRows.filter((row) => row.state === 'ready').length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Calendar</CardTitle>
        <CardDescription>
          Derived from recorded sow dates, frost dates, and the plant library&apos;s
          maturity figures — not live measurements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">{clock.note}</p>
          {clock.daysUntilFirstFrost !== null && clock.daysUntilFirstFrost <= 14 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Frost is close — plan covers or harvest anything tender.
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">
            Harvest readiness
            {readyCount > 0 && (
              <Badge variant="default" className="ml-2">
                {readyCount} ready
              </Badge>
            )}
          </h4>
          {readinessRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No plantings recorded on this plan yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {readinessRows.map((row) => {
                const badge = STATE_BADGE[row.state]
                return (
                  <li key={row.plantingId} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{row.label}</p>
                      <p className="text-muted-foreground">{row.note}</p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Shopping list</h4>
          {shoppingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No material estimate saved for this plan yet — it is generated when a
              garden is saved from the editor.
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {shoppingList.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
