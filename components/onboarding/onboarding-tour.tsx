/**
 * Onboarding Tour - Interactive product tour for first-time editor visitors
 *
 * A step-through dialog describing the editor's real panels and workflows.
 * Shown once automatically; restartable via RestartTourButton. Progress is
 * tracked in localStorage.
 *
 * The step copy deliberately describes only what the editor actually has --
 * an earlier draft of this component advertised NOAA sun analysis and sector
 * analysis tabs that were never built, and a tour that lies is worse than no
 * tour.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Target,
  Sprout,
  Download,
  MousePointer2,
  Keyboard,
} from 'lucide-react'

export const TOUR_STORAGE_KEY = 'permaculture-tour-completed'

interface OnboardingTourProps {
  /** Whether to show the tour automatically on first visit */
  autoStart?: boolean
  /**
   * Open the tour regardless of the seen flag. RestartTourButton remounts the
   * tour with this after flipping the localStorage flag, so a restart always
   * shows step one.
   */
  forceOpen?: boolean
  /** Callback when tour is completed */
  onComplete?: () => void
  /** Callback when tour is skipped */
  onSkip?: () => void
}

interface TourStep {
  title: string
  description: string
  icon: React.ElementType
  tip?: string
  keyboardShortcut?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Your Permaculture Planner!',
    description:
      'This is your design workspace for regenerative gardens. Take a minute to see where everything lives -- you can skip this tour and restart it anytime.',
    icon: Sparkles,
  },
  {
    title: 'Left Panel: Plants & Elements',
    description:
      'Browse the plant library (with spacing, sun and water needs from the plant database) or add elements like beds, paths and water features. Click one, then click the canvas to place it.',
    icon: Sprout,
    tip: 'Search the library by name or filter by category to find plants fast',
  },
  {
    title: 'Canvas: Your Design Workspace',
    description:
      'Pan with the mouse, zoom with the wheel, and select anything to move or resize it. Beds show their dimensions; plants keep their recorded position.',
    icon: MousePointer2,
    tip: 'Everything is saved automatically about two seconds after you stop moving',
  },
  {
    title: 'Right Panel: Analysis & Properties',
    description:
      'Edit what you select, and read the analysis panels: plan insights, recorded site facts from your wizard answers, garden tools, and design facts like water demand and yield projections.',
    icon: Target,
    keyboardShortcut: '⌘]',
    tip: 'Toggle either panel with ⌘[ and ⌘]',
  },
  {
    title: 'Export & Share',
    description:
      'Download your plan as JSON (re-importable), PNG, SVG, or a print-ready PDF sized to the plan. Look for the Export button in the header.',
    icon: Download,
  },
  {
    title: "You're Ready to Design!",
    description:
      'Start with beds, then place plants. The analysis panels read what you actually saved, so the more you record, the better the guidance. Enjoy building your regenerative garden!',
    icon: Sparkles,
  },
]

export function OnboardingTour({ autoStart = false, forceOpen = false, onComplete, onSkip }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenTour, setHasSeenTour] = useState(false)

  // First visit: open automatically; otherwise just record that the tour was
  // seen, which is what enables the floating restart button.
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_STORAGE_KEY)
    setHasSeenTour(!!seen)

    if (autoStart && !seen) {
      // Let the editor mount and settle before covering it
      const timer = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [autoStart])

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true')
      setIsOpen(false)
      setHasSeenTour(true)
      onComplete?.()
    }
  }, [currentStep, onComplete])

  const handlePrevious = useCallback(() => {
    setCurrentStep((step) => Math.max(0, step - 1))
  }, [])

  const handleSkip = useCallback(() => {
    setIsOpen(false)
    onSkip?.()
  }, [onSkip])

  const handleRestart = useCallback(() => {
    setCurrentStep(0)
    setIsOpen(true)
  }, [])

  const step = TOUR_STEPS[currentStep]
  const StepIcon = step.icon
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100

  return (
    <>
      {/* Restart entry point for users who have completed or skipped it.
          Hidden when forceOpen is set: that variant is driven by
          RestartTourButton, which renders its own entry point. */}
      {hasSeenTour && !isOpen && !forceOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          className="fixed bottom-4 right-4 z-50 shadow-lg"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Tour
        </Button>
      )}

      <Dialog open={isOpen || forceOpen} onOpenChange={(open) => { if (!open) handleSkip() }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="font-mono text-xs">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-8 w-8 p-0"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                <StepIcon className="h-5 w-5 text-green-600" />
              </div>
              {step.title}
            </DialogTitle>
            {step.keyboardShortcut && (
              <div className="flex items-center gap-2 mt-1">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  {step.keyboardShortcut}
                </code>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <DialogDescription className="text-sm leading-relaxed">
              {step.description}
            </DialogDescription>

            {step.tip && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-3 pb-2 px-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-amber-900">{step.tip}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentStep === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <Button size="sm" onClick={handleNext} className="bg-green-600 hover:bg-green-700">
                {currentStep === TOUR_STEPS.length - 1 ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Menu entry that reopens the tour from step one. It remounts OnboardingTour
 * with forceOpen after marking the tour seen, so a restart works even though
 * the tour would not auto-open again.
 */
export function RestartTourButton() {
  const [restartKey, setRestartKey] = useState(0)

  const restart = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    setRestartKey((key) => key + 1)
  }, [])

  return (
    <>
      <Button variant="ghost" size="sm" onClick={restart} className="w-full justify-start">
        <Sparkles className="h-4 w-4 mr-2" />
        Product Tour
      </Button>
      {restartKey > 0 && (
        <OnboardingTour
          key={restartKey}
          forceOpen
          onComplete={() => setRestartKey(0)}
          onSkip={() => setRestartKey(0)}
        />
      )}
    </>
  )
}
