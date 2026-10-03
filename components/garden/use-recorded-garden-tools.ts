'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/http'
import { GardenTools, summarizeGardenTools } from '@/lib/garden/garden-tools'
import { HarvestInput, SiteBedInput, SiteMaterialsInput, siteFactsFromPlan } from '@/lib/garden/site-facts'

interface PlanFactResponse {
  site?: {
    usda_zone?: unknown
    last_frost?: unknown
    first_frost?: unknown
    lat?: unknown
    lng?: unknown
    surface_type?: unknown
    slope_pct?: unknown
    shade_notes?: unknown
    water_source?: unknown
    constraints_json?: unknown
  } | null
  beds?: SiteBedInput[]
  materials_estimates?: SiteMaterialsInput | null
  harvests?: HarvestInput[] | null
}

const unavailable: GardenTools = {
  sun: ['The saved plan could not be loaded.'],
  water: ['The saved plan could not be loaded.'],
  growth: ['The saved plan could not be loaded.'],
  sectors: ['The saved plan could not be loaded.'],
  succession: ['The saved plan could not be loaded.'],
  materials: ['The saved plan could not be loaded.'],
}

export function useRecordedGardenTools(planId?: string): GardenTools | null {
  const [tools, setTools] = useState<GardenTools | null>(null)

  useEffect(() => {
    if (!planId) {
      setTools(summarizeGardenTools({}))
      return
    }

    let cancelled = false
    api<PlanFactResponse>(`/api/plans/${planId}`)
      .then((plan) => {
        if (!cancelled) setTools(summarizeGardenTools(siteFactsFromPlan(plan)))
      })
      .catch(() => {
        if (!cancelled) setTools(unavailable)
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  return tools
}
