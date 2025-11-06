import * as React from 'react'
import { useAuth } from '@/stores/auth-simple'
import { Badge } from '@/components/ui/badge'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  const activeTeam = teams[0] // Use first team as the active organization

  // Determine user role badge
  const getRoleBadge = () => {
    if (user?.isGod) {
      return <Badge variant="gold">God</Badge>
    }
    // TODO: Fetch actual role from organization API
    // For now, assume owner if not god
    return <Badge variant="default">Owner</Badge>
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className='flex items-center gap-2 px-2 py-2'>
          <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
            <activeTeam.logo className='size-4' />
          </div>
          <div className='flex flex-1 items-center gap-2 text-start text-sm leading-tight'>
            <span className='truncate font-semibold'>
              {activeTeam.name}
            </span>
            {getRoleBadge()}
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
