'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/http'
import { HarvestInput, SiteBedInput, SiteFacts, SiteMaterialsInput, siteFactsFromPlan, summarizeSiteFacts } from '@/lib/garden/site-facts'

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

export function useRecordedSiteFacts(planId?: string): SiteFacts | null {
  const [facts, setFacts] = useState<SiteFacts | null>(null)

  useEffect(() => {
    if (!planId) {
      setFacts(summarizeSiteFacts({}))
      return
    }

    let cancelled = false
    api<PlanFactResponse>(`/api/plans/${planId}`)
      .then((plan) => {
        if (!cancelled) setFacts(summarizeSiteFacts(siteFactsFromPlan(plan)))
      })
      .catch(() => {
        if (!cancelled) {
          const unavailable = ['The saved site could not be loaded.']
          setFacts({
            soil: unavailable,
            topography: unavailable,
            climate: unavailable,
            infrastructure: unavailable,
            biodiversity: unavailable,
            energy: unavailable,
            community: unavailable,
            economics: unavailable,
            resilience: unavailable,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  return facts
}
