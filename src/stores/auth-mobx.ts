/**
 * MobX Auth Store
 * 
 * Reactive authentication state management using MobX
 */

import { makeAutoObservable, runInAction } from 'mobx'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

interface Session {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string
  userAgent?: string
}

class AuthStore {
  user: User | null = null
  session: Session | null = null
  isLoading = true
  error: Error | null = null
  lastRedirectPath: string | null = null
  preferredTheme: 'light' | 'dark' | 'system' = 'system'

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    this.initializeAuth()
  }

  async initializeAuth() {
    try {
      const session = await authClient.getSession()
      
      runInAction(() => {
        if (session.data?.user && session.data?.session) {
          this.user = session.data.user
          this.session = session.data.session
        }
        this.isLoading = false
      })
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error('Failed to initialize auth')
        this.isLoading = false
      })
    }
  }

  async signIn(email: string, password: string) {
    this.isLoading = true
    this.error = null

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      runInAction(() => {
        if (result.data?.user && result.data?.session) {
          this.user = result.data.user
          this.session = result.data.session
        } else if (result.error) {
          this.error = new Error(result.error.message || 'Sign in failed')
        }
        this.isLoading = false
      })

      return result
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error('Sign in failed')
        this.isLoading = false
      })
      throw error
    }
  }

  async signUp(email: string, password: string, name: string) {
    this.isLoading = true
    this.error = null

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      })

      runInAction(() => {
        if (result.data?.user && result.data?.session) {
          this.user = result.data.user
          this.session = result.data.session
        } else if (result.error) {
          this.error = new Error(result.error.message || 'Sign up failed')
        }
        this.isLoading = false
      })

      return result
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error('Sign up failed')
        this.isLoading = false
      })
      throw error
    }
  }

  async signOut() {
    this.isLoading = true

    try {
      await authClient.signOut()

      runInAction(() => {
        this.user = null
        this.session = null
        this.isLoading = false
      })
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error('Sign out failed')
        this.isLoading = false
      })
    }
  }

  async refreshSession() {
    try {
      const session = await authClient.getSession()
      
      runInAction(() => {
        if (session.data?.user && session.data?.session) {
          this.user = session.data.user
          this.session = session.data.session
        }
      })
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error('Failed to refresh session')
      })
    }
  }

  setRedirectPath(path: string | null) {
    this.lastRedirectPath = path
  }

  setTheme(theme: 'light' | 'dark' | 'system') {
    this.preferredTheme = theme
  }

  clearError() {
    this.error = null
  }

  // Computed values
  get isAuthenticated() {
    return !!this.session && !!this.user
  }

  get userEmail() {
    return this.user?.email || null
  }

  get userName() {
    return this.user?.name || null
  }
}

// Create singleton instance
export const authStore = new AuthStore()

