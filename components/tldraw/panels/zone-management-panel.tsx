'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { ZonesToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function ZoneManagementPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <ZonesToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
