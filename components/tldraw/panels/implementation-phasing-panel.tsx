'use client'

import { ImplementationFactCard } from '@/components/garden/design-fact-panels'
import { DesignFacts } from '@/lib/garden/design-facts'

export function ImplementationPhasingPanel({ design }: { design: DesignFacts | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3">
        <ImplementationFactCard design={design} />
      </div>
    </div>
  )
}
