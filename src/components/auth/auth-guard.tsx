/**
 * Authentication Guard using Better Auth native patterns
 * 
 * Redirects to sign-in when user is not authenticated
 */

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useAuth } from '@/stores/auth-simple'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard = observer(({ children }: AuthGuardProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  
  // Use ref to prevent multiple redirects
  const hasRedirected = useRef(false)

  useEffect(() => {
    // Only redirect once when auth check is complete
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true
      const currentPath = location.href
      
      // Redirect to sign-in with current path for redirect after login
      navigate({
        to: '/sign-in',
        search: { redirect: currentPath },
        replace: true,
      })
    }
    
    // Reset redirect flag when authenticated
    if (isAuthenticated) {
      hasRedirected.current = false
    }
  }, [isAuthenticated, isLoading, location.href, navigate])

  // Show nothing while loading or if not authenticated
  if (isLoading || !isAuthenticated) {
    return null
  }

  return <>{children}</>
})