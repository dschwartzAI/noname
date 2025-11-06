/**
 * React Hook for MobX Auth Store
 * 
 * Provides reactive access to authentication state
 */

import { observer } from 'mobx-react-lite'
import { authStore } from '@/stores/auth-mobx'

export function useAuthMobx() {
  return {
    // State
    user: authStore.user,
    session: authStore.session,
    isLoading: authStore.isLoading,
    error: authStore.error,
    isAuthenticated: authStore.isAuthenticated,
    
    // Computed
    userEmail: authStore.userEmail,
    userName: authStore.userName,
    
    // Actions
    signIn: authStore.signIn,
    signUp: authStore.signUp,
    signOut: authStore.signOut,
    refreshSession: authStore.refreshSession,
    setRedirectPath: authStore.setRedirectPath,
    setTheme: authStore.setTheme,
    clearError: authStore.clearError,
  }
}

// Export the observer HOC for components that need to react to store changes
export { observer }

