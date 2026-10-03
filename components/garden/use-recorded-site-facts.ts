'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/http'
import { SiteBedInput, SiteFacts, SiteMaterialsInput, siteFactsFromPlan, summarizeSiteFacts } from '@/lib/garden/site-facts'

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
          setFacts({
            soil: ['The saved site could not be loaded.'],
            topography: ['The saved site could not be loaded.'],
            climate: ['The saved site could not be loaded.'],
            infrastructure: ['The saved site could not be loaded.'],
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  return facts
}
