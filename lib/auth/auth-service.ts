'use client'

import { showError, showSuccess, showLoading } from '@/components/ui/action-feedback'
import { api, ApiError } from '@/lib/api/http'

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  created_at?: string | null
  is_admin?: boolean
}

export interface SignUpData {
  email: string
  password: string
  name?: string
}

export interface SignInData {
  email: string
  password: string
}

type Listener = (user: AuthUser | null) => void
const listeners = new Set<Listener>()

function emit(user: AuthUser | null) {
  listeners.forEach((listener) => listener(user))
}

async function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export class AuthService {
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const data = await api<{ user: AuthUser | null }>('/api/auth/me')
      return data.user
    } catch (error) {
      console.error('Error in getCurrentUser:', error)
      return null
    }
  }

  async getProfile(userId?: string): Promise<AuthUser | null> {
    const user = await this.getCurrentUser()
    if (!user) return null
    if (userId && user.id !== userId) return null
    return user
  }

  async signUp(data: SignUpData): Promise<{ user: AuthUser | null; error: string | null }> {
    showLoading('Creating your account...')
    try {
      const result = await api<{ user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, password: data.password, name: data.name }),
      })
      emit(result.user)
      showSuccess('Account created. You are signed in.')
      return { user: result.user, error: null }
    } catch (error) {
      const errorMessage = await readError(error, 'Failed to create account')
      showError(errorMessage)
      return { user: null, error: errorMessage }
    }
  }

  async signIn(data: SignInData): Promise<{ user: AuthUser | null; error: string | null }> {
    showLoading('Signing you in...')
    try {
      const result = await api<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      emit(result.user)
      showSuccess('Welcome back!')
      return { user: result.user, error: null }
    } catch (error) {
      const errorMessage = await readError(error, 'Failed to sign in')
      showError(errorMessage)
      return { user: null, error: errorMessage }
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    showLoading('Signing you out...')
    try {
      await api('/api/auth/logout', { method: 'POST' })
      emit(null)
      showSuccess('Signed out successfully')
      return { error: null }
    } catch (error) {
      const errorMessage = await readError(error, 'Failed to sign out')
      showError(errorMessage)
      return { error: errorMessage }
    }
  }

  async updateProfile(updates: { name?: string | null }): Promise<{ user: AuthUser | null; error: string | null }> {
    showLoading('Updating profile...')
    try {
      const result = await api<{ user: AuthUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: updates.name || '' }),
      })
      emit(result.user)
      showSuccess('Profile updated successfully')
      return { user: result.user, error: null }
    } catch (error) {
      const errorMessage = await readError(error, 'Failed to update profile')
      showError(errorMessage)
      return { user: null, error: errorMessage }
    }
  }

  async resetPassword(email: string): Promise<{ error: string | null; resetUrl?: string }> {
    showLoading('Preparing password reset...')
    try {
      const result = await api<{ message?: string; resetUrl?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      showSuccess(result.resetUrl ? 'Reset link is ready below.' : 'If that email has an account, a reset link is ready.')
      return { error: null, resetUrl: result.resetUrl }
    } catch (error) {
      const errorMessage = await readError(error, 'Failed to send reset email')
      showError(errorMessage)
      return { error: errorMessage }
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    listeners.add(callback)
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    }
  }

  async getSession() {
    const user = await this.getCurrentUser()
    return user ? { user } : null
  }

  async refreshSession() {
    return this.getSession()
  }
}

export const authService = new AuthService()
