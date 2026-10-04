'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/http'
import { DesignFacts, summarizeDesignFacts } from '@/lib/garden/design-facts'
import { GardenTools, summarizeGardenTools } from '@/lib/garden/garden-tools'
import { HarvestInput, JournalInput, RecordedTaskInput, SiteBedInput, SiteMaterialsInput, siteFactsFromPlan } from '@/lib/garden/site-facts'

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
  tasks?: RecordedTaskInput[] | null
  journal?: JournalInput[] | null
  meta?: { template?: unknown } | null
}

const unavailableTools: GardenTools = {
  sun: ['The saved plan could not be loaded.'],
  water: ['The saved plan could not be loaded.'],
  growth: ['The saved plan could not be loaded.'],
  sectors: ['The saved plan could not be loaded.'],
  succession: ['The saved plan could not be loaded.'],
  materials: ['The saved plan could not be loaded.'],
  zones: ['The saved plan could not be loaded.'],
  tasks: ['The saved plan could not be loaded.'],
  timeline: ['The saved plan could not be loaded.'],
}

const unavailableDesign: DesignFacts = {
  companions: ['The saved plan could not be loaded.'],
  relationships: ['The saved plan could not be loaded.'],
  evolution: ['The saved plan could not be loaded.'],
  implementation: ['The saved plan could not be loaded.'],
  critique: ['The saved plan could not be loaded.'],
  progress: ['The saved plan could not be loaded.'],
  knowledge: ['The saved plan could not be loaded.'],
  templates: ['The saved plan could not be loaded.'],
  analytics: ['The saved plan could not be loaded.'],
  permaculture: ['The saved plan could not be loaded.'],
}

export function useRecordedPlanTools(planId?: string): {
  tools: GardenTools | null
  design: DesignFacts | null
} {
  const [tools, setTools] = useState<GardenTools | null>(null)
  const [design, setDesign] = useState<DesignFacts | null>(null)

  useEffect(() => {
    if (!planId) {
      setTools(summarizeGardenTools({}))
      setDesign(summarizeDesignFacts({}))
      return
    }

    let cancelled = false
    api<PlanFactResponse>(`/api/plans/${planId}`)
      .then((plan) => {
        if (cancelled) return
        const facts = siteFactsFromPlan(plan)
        setTools(summarizeGardenTools(facts))
        setDesign(summarizeDesignFacts(facts))
      })
      .catch(() => {
        if (cancelled) return
        setTools(unavailableTools)
        setDesign(unavailableDesign)
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  return { tools, design }
}
