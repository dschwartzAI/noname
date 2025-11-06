import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { AuthGuard } from '@/components/auth/auth-guard'
import { useUserSysEvents } from '@/hooks/use-user-sys-events'
import { useAuth } from '@/stores/auth-simple'
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { ConversationNavGroup } from './conversation-nav-group'
import { mockConversations } from '@/features/ai-chat/data/mock-conversations'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { user } = useAuth()
  const navigate = useNavigate()
  const params = useParams({ strict: false })

  // Get active conversation ID from URL params
  const activeConversationId = 'conversationId' in params ? params.conversationId : undefined

  // Connect to UserSysDO for remote auth events
  useUserSysEvents(user?.id || null)

  // Handle new chat navigation
  const handleNewChat = () => {
    navigate({ to: '/ai-chat' })
  }

  return (
    <AuthGuard>
      <SearchProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <LayoutProvider>
            <SkipToMain />
            <AppSidebar>
              <SidebarHeader>
                <TeamSwitcher teams={sidebarData.teams} />
              </SidebarHeader>
              <SidebarContent>
                {/* Main navigation */}
                {sidebarData.navGroups.map((props) => (
                  <NavGroup key={props.title} {...props} />
                ))}

                {/* Separator */}
                <SidebarSeparator className="my-2" />

                {/* Chat history */}
                <ConversationNavGroup
                  conversations={mockConversations}
                  activeConversationId={activeConversationId}
                  onNewChat={handleNewChat}
                />
              </SidebarContent>
              <SidebarFooter>
                <NavUser user={sidebarData.user} />
              </SidebarFooter>
              <SidebarRail />
            </AppSidebar>
            <SidebarInset
              className={cn(
                // If layout is fixed, set the height
                // to 100svh to prevent overflow
                'has-[[data-layout=fixed]]:h-svh',

                // If layout is fixed and sidebar is inset,
                // set the height to 100svh - 1rem (total margins) to prevent overflow
                // 'peer-data-[variant=inset]:has-[[data-layout=fixed]]:h-[calc(100svh-1rem)]',
                'peer-data-[variant=inset]:has-[[data-layout=fixed]]:h-[calc(100svh-(var(--spacing)*4))]',

                // Set content container, so we can use container queries
                '@container/content'
              )}
            >
              {children ?? <Outlet />}
            </SidebarInset>
          </LayoutProvider>
        </SidebarProvider>
      </SearchProvider>
    </AuthGuard>
  )
}
