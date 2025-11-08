import * as React from 'react'
import { useAuth } from '@/stores/auth-simple'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { user } = useAuth()
  const { open } = useSidebar()
  const activeTeam = teams[0] // Use first team as the active organization

  // Fetch organization data to get logo
  const { data: orgData } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current');
      if (!res.ok) throw new Error('Failed to fetch organization');
      return res.json();
    },
    enabled: !!user,
  });

  const organization = orgData?.organization;
  const hasCustomLogo = !!organization?.logo;

  // Determine user role badge (only show when sidebar is open)
  const getRoleBadge = () => {
    if (!open) return null // Hide badge when sidebar is collapsed

    if (user?.isGod) {
      return <Badge variant="gold">God</Badge>
    }
    // Use role from organization if available
    if (organization?.role) {
      return <Badge variant="default">{organization.role}</Badge>
    }
    return <Badge variant="default">Member</Badge>
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className='flex items-center gap-2 px-1 py-1.5'>
          <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden'>
            {hasCustomLogo ? (
              <img
                src={organization.logo}
                alt={organization.name || activeTeam.name}
                className='h-full w-full object-contain'
              />
            ) : (
              <activeTeam.logo className='size-4' />
            )}
          </div>
          {open && (
            <div className='flex flex-1 items-center gap-2 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>
                {organization?.name || activeTeam.name}
              </span>
              {getRoleBadge()}
            </div>
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
