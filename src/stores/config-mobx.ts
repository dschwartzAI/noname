/**
 * MobX Configuration Store
 * 
 * Global application configuration and UI state
 */

import { makeAutoObservable } from 'mobx'

export interface Config {
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  language: string
  notifications: boolean
}

class ConfigStore {
  theme: 'light' | 'dark' | 'system' = 'system'
  sidebarOpen = true
  sidebarCollapsed = false
  language = 'en'
  notifications = true

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    this.loadFromLocalStorage()
  }

  // Theme actions
  setTheme(theme: 'light' | 'dark' | 'system') {
    this.theme = theme
    this.saveToLocalStorage()
  }

  // Sidebar actions
  setSidebarOpen(open: boolean) {
    this.sidebarOpen = open
    this.saveToLocalStorage()
  }

  setSidebarCollapsed(collapsed: boolean) {
    this.sidebarCollapsed = collapsed
    this.saveToLocalStorage()
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen
    this.saveToLocalStorage()
  }

  toggleSidebarCollapsed() {
    this.sidebarCollapsed = !this.sidebarCollapsed
    this.saveToLocalStorage()
  }

  // Language actions
  setLanguage(language: string) {
    this.language = language
    this.saveToLocalStorage()
  }

  // Notifications actions
  setNotifications(enabled: boolean) {
    this.notifications = enabled
    this.saveToLocalStorage()
  }

  toggleNotifications() {
    this.notifications = !this.notifications
    this.saveToLocalStorage()
  }

  // Persistence
  private saveToLocalStorage() {
    if (typeof window === 'undefined') return
    
    const config: Config = {
      theme: this.theme,
      sidebarOpen: this.sidebarOpen,
      sidebarCollapsed: this.sidebarCollapsed,
      language: this.language,
      notifications: this.notifications,
    }
    
    localStorage.setItem('app-config', JSON.stringify(config))
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem('app-config')
      if (stored) {
        const config: Config = JSON.parse(stored)
        this.theme = config.theme
        this.sidebarOpen = config.sidebarOpen
        this.sidebarCollapsed = config.sidebarCollapsed
        this.language = config.language
        this.notifications = config.notifications
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error)
    }
  }

  // Reset to defaults
  reset() {
    this.theme = 'system'
    this.sidebarOpen = true
    this.sidebarCollapsed = false
    this.language = 'en'
    this.notifications = true
    this.saveToLocalStorage()
  }

  // Computed values
  get config(): Config {
    return {
      theme: this.theme,
      sidebarOpen: this.sidebarOpen,
      sidebarCollapsed: this.sidebarCollapsed,
      language: this.language,
      notifications: this.notifications,
    }
  }
}

// Create singleton instance
export const configStore = new ConfigStore()

