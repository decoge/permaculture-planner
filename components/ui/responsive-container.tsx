import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ResponsiveContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: boolean
}

/**
 * Responsive container that adapts to different screen sizes
 * Ensures consistent spacing and max-width across the app
 */
export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'xl',
  padding = true,
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-(--breakpoint-sm)',
    md: 'max-w-(--breakpoint-md)',
    lg: 'max-w-(--breakpoint-lg)',
    xl: 'max-w-(--breakpoint-xl)',
    '2xl': 'max-w-(--breakpoint-2xl)',
    full: 'max-w-full',
  }

  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        padding && 'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  )
}