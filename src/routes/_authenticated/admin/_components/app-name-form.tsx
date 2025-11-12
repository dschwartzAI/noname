"use client"

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface OrganizationResponse {
  organization: {
    id: string
    name: string
    role?: string
    metadata?: {
      branding?: Record<string, unknown>
      [key: string]: unknown
    } | null
  } | null
}

export function AppNameForm() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<OrganizationResponse>({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current')
      if (!res.ok) throw new Error('Failed to fetch organization')
      return res.json()
    },
  })

  const organization = data?.organization
  const existingName =
    organization?.metadata &&
    typeof organization.metadata === 'object' &&
    organization.metadata !== null &&
    typeof (organization.metadata as { branding?: { companyName?: string } }).branding === 'object'
      ? ((organization.metadata as { branding?: { companyName?: string } }).branding?.companyName ??
          organization?.name ??
          '')
      : organization?.name ?? ''

  const [appName, setAppName] = useState(existingName)

  useEffect(() => {
    setAppName(existingName)
  }, [existingName])

  const isOwner = organization?.role === 'owner'

  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!organization) {
        throw new Error('Organization not found')
      }

      const trimmedName = name.trim()
      if (!trimmedName) {
        throw new Error('App name is required')
      }

      const currentMetadata =
        (organization.metadata && typeof organization.metadata === 'object'
          ? (organization.metadata as Record<string, unknown>)
          : {}) ?? {}

      const existingBranding =
        (currentMetadata.branding && typeof currentMetadata.branding === 'object'
          ? (currentMetadata.branding as Record<string, unknown>)
          : {}) ?? {}

      const updatedMetadata = {
        ...currentMetadata,
        branding: {
          ...existingBranding,
          companyName: trimmedName,
        },
      }

      const res = await fetch(`/api/organization/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          metadata: updatedMetadata,
        }),
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Failed to update app name')
      }

      return trimmedName
    },
    onSuccess: () => {
      toast.success('App name updated')
      queryClient.invalidateQueries({ queryKey: ['organization', 'current'] })
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['current-organization'] })
      }, 0)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSave = () => {
    updateMutation.mutate(appName)
  }

  return (
    <div className="space-y-3">
      <Input
        value={appName}
        onChange={(event) => setAppName(event.target.value)}
        placeholder="SoloOS"
        disabled={!isOwner || isLoading || updateMutation.isPending}
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={
            !isOwner ||
            isLoading ||
            updateMutation.isPending ||
            appName.trim() === existingName.trim()
          }
        >
          {updateMutation.isPending ? 'Saving...' : 'Save App Name'}
        </Button>
        {!isOwner && (
          <div className="text-sm text-muted-foreground">
            Only organization owners can change the app name.
          </div>
        )}
      </div>
    </div>
  )
}


