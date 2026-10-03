'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GardenTools } from '@/lib/garden/garden-tools'

function FactCard({
  id,
  title,
  description,
  lines,
}: {
  id: string
  title: string
  description: string
  lines: string[]
}) {
  return (
    <Card data-plan-panel={id}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-gray-700">
          {lines.map((line, index) => (
            <li key={`${id}-${index}`}>{line}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const LOADING = ['Loading saved plan facts...']

export function GardenToolPanels({ tools }: { tools: GardenTools | null }) {
  return (
    <div className="space-y-4">
      <SunToolCard tools={tools} />
      <WaterToolCard tools={tools} />
      <GrowthToolCard tools={tools} />
    </div>
  )
}

export function SunToolCard({ tools }: { tools: GardenTools | null }) {
  return (
    <FactCard
      id="sun"
      title="Sun & Shade Analysis"
      description="Plant-library sun needs and the spacing saved on each planting. Sunlight hours are not estimated."
      lines={tools?.sun || LOADING}
    />
  )
}

export function WaterToolCard({ tools }: { tools: GardenTools | null }) {
  return (
    <FactCard
      id="water"
      title="Water Management"
      description="Recorded water source and plant-library water needs. Flow rate is not estimated."
      lines={tools?.water || LOADING}
    />
  )
}

export function GrowthToolCard({ tools }: { tools: GardenTools | null }) {
  return (
    <FactCard
      id="growth"
      title="Growth Simulation"
      description="Recorded season and days to maturity. A growth curve is not calculated."
      lines={tools?.growth || LOADING}
    />
  )
}
