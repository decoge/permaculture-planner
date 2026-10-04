'use client'

import { EvolutionFactCard } from '@/components/garden/design-fact-panels'
import { DesignFacts } from '@/lib/garden/design-facts'

export function GardenEvolutionPanel({ design }: { design: DesignFacts | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3">
        <EvolutionFactCard design={design} />
      </div>
    </div>
  )
}
