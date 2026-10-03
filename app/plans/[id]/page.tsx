'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft, Edit, Trash2, Download, Leaf, Trees, Map, Calendar,
  Loader2, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { BedLayout } from '@/components/garden/bed-layout'
import { PlanInsights } from '@/components/garden/plan-insights'
import { SiteConditionPanels } from '@/components/garden/site-condition-panels'
import { formatPlanSummary, summarizePlan } from '@/lib/garden/plan-summary'
import { formatSiteFacts, siteFactsFromPlan, summarizeSiteFacts } from '@/lib/garden/site-facts'

interface Plan {
  id: string
  name: string
  created_at: string
  updated_at: string
  version: number
  status: string
  site: {
    name: string
    lat: number | string | null
    lng: number | string | null
    usda_zone: string | null
    last_frost?: string | null
    first_frost?: string | null
    surface_type?: string | null
    slope_pct?: number | string | null
    shade_notes?: string | null
    water_source?: string | null
    constraints_json?: unknown
  }
  beds: Array<{
    id: string
    name: string
    length_ft: number
    width_ft: number
    shape: string
    height_in?: number | string | null
    orientation?: string | null
    surface?: string | null
    wicking?: boolean | null
    trellis?: boolean | null
    path_clearance_in?: number | string | null
    notes?: string | null
    plantings?: Array<{
      id: string
      variety: string | null
      successions_json?: { position?: { x: number; y: number } } | null
    }>
  }>
  materials_estimates?: {
    soil_cuft?: number | string | null
    compost_cuft?: number | string | null
    mulch_cuft?: number | string | null
    drip_line_ft?: number | string | null
  } | null
}

export default function PlanViewPage() {
  const params = useParams()
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlan() {
      try {
        const planId = params?.id as string

        if (!planId) {
          setError('No plan ID provided')
          setLoading(false)
          return
        }

        const planData = await api<Plan>(`/api/plans/${planId}`)
        setPlan(planData)
        setLoading(false)
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('An unexpected error occurred')
        setLoading(false)
      }
    }

    loadPlan()
  }, [params, router])

  const handleDelete = async () => {
    if (!plan) return

    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return
    }

    try {
      await api(`/api/plans/${plan.id}`, { method: 'DELETE' })

      router.push('/dashboard')
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan')
    }
  }

  const handleExport = () => {
    if (!plan) return

    const text = [
      formatPlanSummary({
        planName: plan.name,
        siteName: plan.site.name,
        usdaZone: plan.site.usda_zone,
        summary: summarizePlan(plan.beds),
      }),
      '',
      formatSiteFacts(summarizeSiteFacts(siteFactsFromPlan(plan))),
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const filename = `${plan.name.replace(/[^\w.-]+/g, '-')}-summary.txt`
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading plan...</p>
        </div>
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Error Loading Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error || 'Plan not found'}</AlertDescription>
            </Alert>
            <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalArea = plan.beds.reduce((sum, bed) => sum + (bed.length_ft * bed.width_ft), 0)
  const plantCount = plan.beds.reduce((sum, bed) => sum + (bed.plantings?.length || 0), 0)
  const summary = summarizePlan(plan.beds)
  const siteFacts = summarizeSiteFacts(siteFactsFromPlan(plan))

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-white">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-sm text-gray-600">
                  {plan.site.name} • Created {new Date(plan.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/demo?planId=${plan.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Beds</p>
                  <p className="text-3xl font-bold">{plan.beds.length}</p>
                </div>
                <Leaf className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Area</p>
                  <p className="text-3xl font-bold">{Math.round(totalArea)} ft²</p>
                </div>
                <Map className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge className="mt-1">{plan.status}</Badge>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 overflow-hidden">
          <CardHeader>
            <CardTitle>Bed layout</CardTitle>
            <CardDescription>
              {plan.beds.length} beds and {plantCount} plants from this plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-hidden rounded-lg border bg-white">
              <BedLayout beds={plan.beds} className="h-full" />
            </div>
          </CardContent>
        </Card>

        {/* Site Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Site Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-600">Site Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{plan.site.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">USDA Zone</dt>
                <dd className="mt-1 text-sm text-gray-900">{plan.site.usda_zone || 'Not set'}</dd>
              </div>
              {plan.site.lat && plan.site.lng && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Latitude</dt>
                    <dd className="mt-1 text-sm text-gray-900">{plan.site.lat}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Longitude</dt>
                    <dd className="mt-1 text-sm text-gray-900">{plan.site.lng}</dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Beds List */}
        <Card>
          <CardHeader>
            <CardTitle>Garden Beds</CardTitle>
            <CardDescription>All beds in this plan</CardDescription>
          </CardHeader>
          <CardContent>
            {plan.beds.length === 0 ? (
              <p className="text-sm text-gray-600">No beds have been added to this plan yet.</p>
            ) : (
              <div className="space-y-4">
                {plan.beds.map((bed) => (
                  <div key={bed.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Trees className="h-8 w-8 text-green-600" />
                      <div>
                        <h4 className="font-semibold">{bed.name}</h4>
                        <p className="text-sm text-gray-600">
                          {bed.length_ft}&apos; × {bed.width_ft}&apos; • {bed.length_ft * bed.width_ft} ft²
                          {bed.plantings && bed.plantings.length > 0
                            ? ` • ${bed.plantings.map((planting) => planting.variety || 'plant').join(', ')}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{bed.shape}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4">
          <PlanInsights summary={summary} />
          <SiteConditionPanels facts={siteFacts} />
        </aside>
        </div>
      </div>
    </div>
  )
}
