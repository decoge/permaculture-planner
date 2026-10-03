'use client'

import React, { useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlanInsights } from '@/components/garden/plan-insights'
import { summarizePlan } from '@/lib/garden/plan-summary'
import { GardenBed } from '@/lib/garden/garden-types'
import { SiteData } from '@/lib/types/site-context'

interface HolisticDashboardProps {
  gardenBeds: GardenBed[]
  siteData?: SiteData | null
}

export function HolisticDashboardPanel({ gardenBeds }: HolisticDashboardProps) {
  const summary = useMemo(() => summarizePlan(gardenBeds), [gardenBeds])

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <PlanInsights summary={summary} />
      </div>
    </ScrollArea>
  )
}
