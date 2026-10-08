'use client'

import { useMemo, useState } from 'react'
import { api } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sprout, Trash2, Loader2 } from 'lucide-react'

export interface HarvestRecord {
  id: string
  plantingId: string
  quantity: number | null
  unit: string | null
  harvestedOn: string
  variety: string | null
}

interface HarvestRecorderProps {
  planId: string
  /** Plantings available on this plan, for the picker. */
  plantings: Array<{ id: string; variety: string | null }>
  /** Harvests already recorded, from the plan detail payload. */
  harvests: HarvestRecord[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Record a harvest against one of the plan's plantings.
 *
 * Until now the plan page *displayed* harvests but nothing could create them,
 * so the yield and ROI panels permanently said "not recorded".
 */
export function HarvestRecorder({ plantings, harvests }: HarvestRecorderProps) {
  const [plantingId, setPlantingId] = useState<string>(plantings[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('lbs')
  const [harvestedOn, setHarvestedOn] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recorded, setRecorded] = useState<HarvestRecord[]>(harvests)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const varietyById = useMemo(
    () => new Map(plantings.map((planting) => [planting.id, planting.variety])),
    [plantings]
  )

  if (plantings.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            <Sprout className="h-4 w-4 mr-2" />
            Harvests
          </CardTitle>
          <CardDescription>No plantings to harvest yet — place plants in the editor first.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const submit = async () => {
    if (!plantingId) return
    setSaving(true)
    setError(null)
    try {
      await api('/api/harvests', {
        method: 'POST',
        body: JSON.stringify({
          plantingId,
          harvestedOn,
          quantity: quantity.trim() === '' ? null : Number(quantity),
          unit: unit.trim() || null,
        }),
      })
      setRecorded((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          plantingId,
          quantity: quantity.trim() === '' ? null : Number(quantity),
          unit: unit.trim() || null,
          harvestedOn,
          variety: varietyById.get(plantingId) ?? null,
        },
      ])
      setQuantity('')
      setHarvestedOn(today())
    } catch {
      setError('Could not record the harvest. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (id.startsWith('local-')) {
      // Optimistically-added rows have no server id yet; a refresh resolves them.
      setRecorded((prev) => prev.filter((harvest) => harvest.id !== id))
      return
    }
    setDeletingId(id)
    try {
      await api(`/api/harvests/${id}`, { method: 'DELETE' })
      setRecorded((prev) => prev.filter((harvest) => harvest.id !== id))
    } catch {
      setError('Could not delete the harvest.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center">
          <Sprout className="h-4 w-4 mr-2" />
          Harvests
        </CardTitle>
        <CardDescription>
          {recorded.length === 0
            ? 'Nothing recorded yet — record what you pick and the yield panels update.'
            : `${recorded.length} harvest${recorded.length === 1 ? '' : 's'} recorded`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recorded.length > 0 && (
          <div className="space-y-1">
            {recorded.map((harvest) => (
              <div key={harvest.id} className="flex items-center justify-between text-sm">
                <span>
                  {harvest.variety || 'Planting'}
                  {harvest.quantity !== null ? ` — ${harvest.quantity}${harvest.unit ? ` ${harvest.unit}` : ''}` : ' — quantity not recorded'}
                  <span className="block text-xs text-gray-500">{harvest.harvestedOn}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(harvest.id)}
                  disabled={deletingId === harvest.id}
                  aria-label="Delete harvest"
                >
                  {deletingId === harvest.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label htmlFor="harvest-planting" className="text-xs">Planting</Label>
            <Select value={plantingId} onValueChange={setPlantingId}>
              <SelectTrigger id="harvest-planting" className="h-8">
                <SelectValue placeholder="Which planting?" />
              </SelectTrigger>
              <SelectContent>
                {plantings.map((planting) => (
                  <SelectItem key={planting.id} value={planting.id}>
                    {planting.variety || 'Planting'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="harvest-quantity" className="text-xs">Quantity</Label>
              <Input
                id="harvest-quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2.5"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="harvest-unit" className="text-xs">Unit</Label>
              <Input
                id="harvest-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="lbs"
                className="h-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="harvest-date" className="text-xs">Date</Label>
            <Input
              id="harvest-date"
              type="date"
              value={harvestedOn}
              onChange={(e) => setHarvestedOn(e.target.value)}
              className="h-8"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button size="sm" onClick={submit} disabled={saving || !plantingId} className="w-full bg-green-600 hover:bg-green-700">
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Record harvest
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
