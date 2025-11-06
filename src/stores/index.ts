/**
 * MobX Store Index
 * 
 * Central export point for all MobX stores and hooks
 */

// Export MobX stores
export { authStore } from './auth-mobx'
export { aiChatStore } from './ai-chat-mobx'
export { configStore } from './config-mobx'

// Export MobX hooks
export { useAuthMobx, observer } from '@/hooks/use-auth-mobx'
export { useAIChatMobx } from '@/hooks/use-ai-chat-mobx'
export { useConfigMobx } from '@/hooks/use-config-mobx'

// Export types
export type { 
  ChatMessage,
  ChatSettings,
  WebSocketState,
} from './ai-chat-mobx'
export type { Config } from './config-mobx'

// Legacy auth exports for compatibility with Better Auth
export { useAuth, useAuthHelpers, logout, logoutAllDevices, useSession } from './auth-simple'

// Root store interface for global state coordination
export interface RootStore {
  auth: typeof import('./auth-mobx').authStore
  aiChat: typeof import('./ai-chat-mobx').aiChatStore
  config: typeof import('./config-mobx').configStore
}

// Store management utilities
export const storeUtils = {
  // Reset all stores to initial state
  resetAll: () => {
    aiChatStore.clearMessages()
    configStore.reset()
    // Auth reset is handled by Better Auth's signOut
  },
  
  // Get all store states for debugging
  getDebugState: () => ({
    auth: {
      isAuthenticated: authStore.isAuthenticated,
      user: authStore.user,
      isLoading: authStore.isLoading,
    },
    aiChat: {
      messageCount: aiChatStore.messageCount,
      isStreaming: aiChatStore.isStreaming,
      settings: aiChatStore.settings,
      websocket: aiChatStore.websocket,
    },
    config: configStore.config,
  }),
}

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Attach stores to window for debugging
  ;(globalThis as unknown as Record<string, unknown>).__MOBX_STORES__ = {
    auth: authStore,
    aiChat: aiChatStore,
    config: configStore,
    getDebugState: storeUtils.getDebugState
  }
}

// Export auth compatibility hooks (legacy support)
export const useAuthUser = () => {
  const { user } = useAuth()
  return user
}

export const useAuthState = () => {
  const auth = useAuth()
  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error
  }
}

// Legacy compatibility placeholders
export const useAuthSelector = useAuthState
export const useAuthActions = () => ({
  logout,
  logoutAllDevices
})
