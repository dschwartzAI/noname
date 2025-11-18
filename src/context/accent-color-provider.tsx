"use client"

import { createContext, useContext, useEffect, useState, useMemo } from 'react'

type AccentColorProviderState = {
  accentColor: string | null
  setAccentColor: (color: string | null) => void
}

const DEFAULT_ACCENT_COLOR = null // Use theme default

const AccentColorContext = createContext<AccentColorProviderState>({
  accentColor: DEFAULT_ACCENT_COLOR,
  setAccentColor: () => null,
})

export function AccentColorProvider({
  children,
  initialAccentColor,
  userId,
}: {
  children: React.ReactNode
  initialAccentColor?: string | null
  userId?: string | null
}) {
  const [accentColor, _setAccentColor] = useState<string | null>(() => {
    // Initialize from localStorage or initial prop
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('accent-color')
      return stored || initialAccentColor || null
    }
    return initialAccentColor || DEFAULT_ACCENT_COLOR
  })

  // Update accent color when initialAccentColor prop changes
  useEffect(() => {
    if (initialAccentColor !== undefined) {
      if (initialAccentColor) {
        _setAccentColor(initialAccentColor)
        localStorage.setItem('accent-color', initialAccentColor)
      } else {
        _setAccentColor(null)
        localStorage.removeItem('accent-color')
      }
    }
  }, [initialAccentColor])

  // Apply accent color to CSS variables
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const root = document.documentElement
    
    if (accentColor) {
      // Convert hex to RGB for better color manipulation
      const hex = accentColor.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      
      // Calculate lightness for adaptive colors
      const lightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      const isLight = lightness > 0.5
      
      // Set accent color CSS variable - override default accent
      // Convert hex to oklch format for consistency with theme, or use hex directly
      root.style.setProperty('--accent', accentColor)
      
      // Set accent foreground (white or black based on lightness)
      const accentForeground = isLight ? '#000000' : '#ffffff'
      root.style.setProperty('--accent-foreground', accentForeground)
      
      // Set ring color (slightly transparent version) - override default ring
      // Using rgba format for transparency
      root.style.setProperty('--ring', `${accentColor}40`)
      
      // Set border accent color (subtle version for accent borders)
      const borderOpacity = isLight ? '0.2' : '0.3'
      const borderAlpha = Math.round(parseFloat(borderOpacity) * 255).toString(16).padStart(2, '0')
      root.style.setProperty('--border-accent', `${accentColor}${borderAlpha}`)
    } else {
      // Reset to defaults - remove custom overrides to let theme defaults take over
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-foreground')
      root.style.removeProperty('--ring')
      root.style.removeProperty('--border-accent')
    }
  }, [accentColor])

  const setAccentColor = async (color: string | null) => {
    _setAccentColor(color)
    
    if (color) {
      localStorage.setItem('accent-color', color)
    } else {
      localStorage.removeItem('accent-color')
    }

    // Save to database if user is logged in
    if (userId) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accentColor: color }),
          credentials: 'include',
        })

        if (!response.ok) {
          console.error('Failed to save accent color')
        }
      } catch (error) {
        console.error('Error saving accent color:', error)
      }
    }
  }

  const contextValue = useMemo(
    () => ({
      accentColor,
      setAccentColor,
    }),
    [accentColor]
  )

  return (
    <AccentColorContext.Provider value={contextValue}>
      {children}
    </AccentColorContext.Provider>
  )
}

export const useAccentColor = () => {
  const context = useContext(AccentColorContext)

  if (!context) {
    throw new Error('useAccentColor must be used within an AccentColorProvider')
  }

  return context
}

// Wrapper component that fetches user preferences
export function AccentColorProviderWithAuth({
  children,
}: {
  children: React.ReactNode
}) {
  // This will be used in authenticated layouts where we have access to user
  // For now, we'll use localStorage and update from user preferences when available
  const [accentColor, setAccentColorState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accent-color')
    }
    return null
  })

  useEffect(() => {
    // Try to get user preferences from session
    const checkUserPreferences = async () => {
      try {
        const response = await fetch('/api/user/profile', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          const userAccentColor = data.profile?.preferences?.accentColor
          if (userAccentColor) {
            setAccentColorState(userAccentColor)
            localStorage.setItem('accent-color', userAccentColor)
          }
        }
      } catch (error) {
        // Silently fail - user might not be logged in
      }
    }

    checkUserPreferences()
  }, [])

  return (
    <AccentColorProvider
      initialAccentColor={accentColor}
      userId={null} // Will be set by the form component when saving
    >
      {children}
    </AccentColorProvider>
  )
}

