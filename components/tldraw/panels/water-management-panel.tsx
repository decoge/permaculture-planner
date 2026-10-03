'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { WaterToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function WaterManagementPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <WaterToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
