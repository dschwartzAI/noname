/**
 * React Hook for MobX Config Store
 * 
 * Provides reactive access to application configuration
 */

import { observer } from 'mobx-react-lite'
import { configStore } from '@/stores/config-mobx'

export function useConfigMobx() {
  return {
    // State
    theme: configStore.theme,
    sidebarOpen: configStore.sidebarOpen,
    sidebarCollapsed: configStore.sidebarCollapsed,
    language: configStore.language,
    notifications: configStore.notifications,
    
    // Computed
    config: configStore.config,
    
    // Actions
    setTheme: configStore.setTheme,
    setSidebarOpen: configStore.setSidebarOpen,
    setSidebarCollapsed: configStore.setSidebarCollapsed,
    toggleSidebar: configStore.toggleSidebar,
    toggleSidebarCollapsed: configStore.toggleSidebarCollapsed,
    setLanguage: configStore.setLanguage,
    setNotifications: configStore.setNotifications,
    toggleNotifications: configStore.toggleNotifications,
    reset: configStore.reset,
  }
}

export { observer }

