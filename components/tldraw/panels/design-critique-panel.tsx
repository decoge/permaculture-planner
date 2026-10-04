'use client'

import { CritiqueFactCard } from '@/components/garden/design-fact-panels'
import { DesignFacts } from '@/lib/garden/design-facts'

export function DesignCritiquePanel({ design }: { design: DesignFacts | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3">
        <CritiqueFactCard design={design} />
      </div>
    </div>
  )
}
