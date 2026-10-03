'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Leaf, Mail, Lock, LogIn, ArrowRight } from 'lucide-react'
import { api, ApiError } from '@/lib/api/http'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check for error from auth callback URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const errorFromCallback = params.get('error')
    if (errorFromCallback) {
      setError(decodeURIComponent(errorFromCallback))
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      router.push('/dashboard')
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Leaf className="h-8 w-8 text-green-600" />
            Permaculture Planner
          </Link>
        </div>

        <Card className="shadow-xl opacity-0 animate-scale-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
          <CardHeader className="opacity-0 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your permaculture plans</CardDescription>
          </CardHeader>
        <CardContent className="opacity-0 animate-slide-in-left" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/reset-password" className="text-sm text-green-600 hover:text-green-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

        </CardContent>
        <CardFooter className="opacity-0 animate-fade-in" style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}>
          <p className="text-center text-sm text-gray-600 w-full">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-green-600 hover:text-green-700 font-medium">
              Sign up <ArrowRight className="inline h-3 w-3" />
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Demo Link */}
      <div className="text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}>
        <Link href="/demo" className="text-sm text-gray-600 hover:text-gray-800">
          Or try the demo without signing in →
        </Link>
      </div>
    </div>
  </div>
  )
}