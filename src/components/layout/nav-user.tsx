import { Link } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  LogOut,
  Settings,
  Bookmark,
  FileText,
  Users,
} from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { SettingsDialog } from '@/components/settings-dialog'

type NavUserProps = {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    avatar?: string // For backward compatibility
    avatarUrl?: string // New profile field
  } | null
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [settingsOpen, setSettingsOpen] = useDialogState()

  // Handle missing user data with fallbacks
  const displayName = user?.name || 'User'
  const displayEmail = user?.email || 'user@example.com'
  // Check all possible avatar fields (image is from Better Auth session)
  const displayAvatar = user?.image || user?.avatarUrl || user?.avatar || ''

  // Generate initials from name or email
  const getInitials = (name: string, email: string) => {
    if (name && name !== 'User') {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }
  const initials = getInitials(displayName, displayEmail)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage src={displayAvatar} alt={displayName} />
                  <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>{displayName}</span>
                  <span className='truncate text-xs'>{displayEmail}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <span className='truncate text-sm font-medium'>{displayEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='#'>
                    <Bookmark />
                    Tags
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='#'>
                    <FileText />
                    Assets
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='#'>
                    <Users />
                    Leads
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSignOutOpen(true)}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
      <SettingsDialog open={!!settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
