'use client'

import { CompanionFactCard } from '@/components/garden/design-fact-panels'
import { DesignFacts } from '@/lib/garden/design-facts'

export function CompanionPlantingPanel({ design }: { design: DesignFacts | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-card">
      <div className="bg-card p-3">
        <CompanionFactCard design={design} />
      </div>
    </div>
  )
}
