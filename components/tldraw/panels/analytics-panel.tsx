'use client'

import { AnalyticsFactCard } from '@/components/garden/design-fact-panels'
import { DesignFacts } from '@/lib/garden/design-facts'

export function AnalyticsPanel({ design }: { design: DesignFacts | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3">
        <AnalyticsFactCard design={design} />
      </div>
    </div>
  )
}
