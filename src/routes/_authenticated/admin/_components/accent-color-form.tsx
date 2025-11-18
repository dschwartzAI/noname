"use client"

import { useState, useEffect } from 'react'
import { useAccentColor } from '@/context/accent-color-provider'
import { useSession } from '@/lib/auth-client'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AccentColorForm() {
  const { accentColor, setAccentColor } = useAccentColor()
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [localColor, setLocalColor] = useState(accentColor || '#8b5cf6')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setLocalColor(accentColor || '#8b5cf6')
  }, [accentColor])

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalColor(e.target.value)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save to database
      if (userId) {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accentColor: localColor }),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to save accent color')
        }
      }
      
      // Update local state
      await setAccentColor(localColor)
      toast.success('Accent color updated successfully')
    } catch (error) {
      console.error('Failed to save accent color:', error)
      toast.error('Failed to save accent color')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    try {
      // Save to database
      if (userId) {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accentColor: null }),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to reset accent color')
        }
      }
      
      // Update local state
      await setAccentColor(null)
      setLocalColor('#8b5cf6')
      toast.success('Accent color reset to default')
    } catch (error) {
      console.error('Failed to reset accent color:', error)
      toast.error('Failed to reset accent color')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="accentColor">Accent Color</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Choose a custom accent color for borders, highlights, and interactive elements throughout the app.
        </p>
        <div className="flex items-center gap-3">
          <Input
            id="accentColor"
            type="color"
            value={localColor}
            onChange={handleColorChange}
            className="h-10 w-20 cursor-pointer"
          />
          <Input
            type="text"
            value={localColor}
            onChange={(e) => {
              const value = e.target.value
              if (/^#[0-9A-Fa-f]{6}$/.test(value) || value === '') {
                setLocalColor(value)
              }
            }}
            placeholder="#8b5cf6"
            className="flex-1 font-mono"
            maxLength={7}
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || localColor === accentColor}
            size="sm"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {accentColor && (
            <Button
              onClick={handleReset}
              disabled={isSaving}
              variant="outline"
              size="sm"
            >
              Reset to Default
            </Button>
          )}
        </div>
      </div>
      {localColor && (
        <div className="mt-4 p-4 rounded-lg border-2" style={{ borderColor: localColor }}>
          <p className="text-sm text-muted-foreground">
            Preview: This border shows how your accent color will appear.
          </p>
        </div>
      )}
    </div>
  )
}

