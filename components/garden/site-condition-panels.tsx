'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SiteFacts } from '@/lib/garden/site-facts'

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

const LOADING = ['Loading saved site facts...']

export function SiteConditionPanels({ facts }: { facts: SiteFacts | null }) {
  return (
    <div className="space-y-4">
      <SoilAnalysisPanel facts={facts} />
      <TopographyPanel facts={facts} />
      <ClimatePanel facts={facts} />
      <InfrastructurePanel facts={facts} />
    </div>
  )
}

export function SoilAnalysisPanel({ facts }: { facts: SiteFacts | null }) {
  return (
    <FactCard
      id="soil"
      title="Soil Analysis"
      description="Recorded surface and plant-library preferences. This is not a soil test."
      lines={facts?.soil || LOADING}
    />
  )
}

export function TopographyPanel({ facts }: { facts: SiteFacts | null }) {
  return (
    <FactCard
      id="topography"
      title="Topography & Grading"
      description="Recorded slope and site area. Contours are not calculated."
      lines={facts?.topography || LOADING}
    />
  )
}

export function ClimatePanel({ facts }: { facts: SiteFacts | null }) {
  return (
    <FactCard
      id="climate"
      title="Climate & Microclimate"
      description="Recorded zone, frost dates, and location. Rainfall is not estimated."
      lines={facts?.climate || LOADING}
    />
  )
}

export function InfrastructurePanel({ facts }: { facts: SiteFacts | null }) {
  return (
    <FactCard
      id="infrastructure"
      title="Site Infrastructure"
      description="Recorded water, beds, and saved structures."
      lines={facts?.infrastructure || LOADING}
    />
  )
}
