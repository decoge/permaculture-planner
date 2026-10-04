'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DesignFacts } from '@/lib/garden/design-facts'

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

export function DesignFactPanels({ design }: { design: DesignFacts | null }) {
  return (
    <div className="space-y-4">
      <CompanionFactCard design={design} />
      <RelationshipFactCard design={design} />
      <EvolutionFactCard design={design} />
      <ImplementationFactCard design={design} />
      <CritiqueFactCard design={design} />
      <ProgressFactCard design={design} />
      <KnowledgeFactCard design={design} />
      <TemplateFactCard design={design} />
      <AnalyticsFactCard design={design} />
      <PermacultureFactCard design={design} />
    </div>
  )
}

export function CompanionFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="companions"
      title="Companion Planting & Guilds"
      description="Companion pairs from the plant library for plants saved in the same bed."
      lines={design?.companions || LOADING}
    />
  )
}

export function RelationshipFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="relationships"
      title="Relationship Mapper"
      description="Plants saved together. Guilds and energy flows are not inferred."
      lines={design?.relationships || LOADING}
    />
  )
}

export function EvolutionFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="evolution"
      title="Garden Evolution Timeline"
      description="Recorded planting season. Yields and milestones are not projected."
      lines={design?.evolution || LOADING}
    />
  )
}

export function ImplementationFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="implementation"
      title="Implementation Phases"
      description="Saved beds and weekly time. Phases and schedules are not created."
      lines={design?.implementation || LOADING}
    />
  )
}

export function CritiqueFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="critique"
      title="Design Critique"
      description="Saved site facts. A design score is not calculated."
      lines={design?.critique || LOADING}
    />
  )
}

export function ProgressFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="progress"
      title="Progress Tracking"
      description="Saved journal entries, harvests, and tasks. Yields are not estimated."
      lines={design?.progress || LOADING}
    />
  )
}

export function KnowledgeFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="knowledge"
      title="Knowledge Base"
      description="Notes saved on this plan. A guide library is not added."
      lines={design?.knowledge || LOADING}
    />
  )
}

export function TemplateFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="templates"
      title="Template Library"
      description="A template saved on this plan. Pattern libraries are not added."
      lines={design?.templates || LOADING}
    />
  )
}

export function AnalyticsFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="analytics"
      title="Analytics Dashboard"
      description="Saved counts, area, and time. Yields and scores are not calculated."
      lines={design?.analytics || LOADING}
    />
  )
}

export function PermacultureFactCard({ design }: { design: DesignFacts | null }) {
  return (
    <FactCard
      id="permaculture"
      title="Permaculture Analysis"
      description="Recorded zone and water source. Principle scores are not calculated."
      lines={design?.permaculture || LOADING}
    />
  )
}
