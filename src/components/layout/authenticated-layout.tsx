import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { AuthGuard } from '@/components/auth/auth-guard'
import { useUserSysEvents } from '@/hooks/use-user-sys-events'
import { useAuth } from '@/stores/auth-simple'
import { Button } from '@/components/ui/button'
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
import { Header } from './header'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { ConversationNavGroup } from './conversation-nav-group'
import { AgentBuilder } from '@/features/ai-chat/components/agent-builder'
import { ThemeSwitch } from '@/components/theme-switch'
import { ImpersonationBanner } from '@/components/god/impersonation-banner'
import { useConversations } from '@/hooks/use-conversations'
import { Skeleton } from '@/components/ui/skeleton'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { user } = useAuth()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const [agentBuilderOpen, setAgentBuilderOpen] = useState(false)

  // Get active conversation ID from URL params
  const activeConversationId = 'conversationId' in params ? params.conversationId : undefined

  // Fetch real conversations from API
  const { data: conversations, isLoading: conversationsLoading, error: conversationsError } = useConversations()

  // Log conversation loading state for debugging
  useEffect(() => {
    console.log('📊 Conversations state:', {
      loading: conversationsLoading,
      count: conversations?.length || 0,
      error: conversationsError
    })
  }, [conversationsLoading, conversations, conversationsError])

  // Connect to UserSysDO for remote auth events
  useUserSysEvents(user?.id || null)

  // Handle new chat navigation
  const handleNewChat = () => {
    navigate({ to: '/ai-chat' })
  }

  // Filter navigation groups based on user role
  const filteredNavGroups = sidebarData.navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Hide God Mode link if user is not a god
      if (item.url === '/admin/god-dashboard') {
        return user?.isGod === true
      }
      return true
    }),
  }))

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
                {filteredNavGroups.map((props) => (
                  <NavGroup key={props.title} {...props} />
                ))}

                {/* Separator */}
                <SidebarSeparator className="my-2" />

                {/* Chat history */}
                {conversationsLoading ? (
                  <div className="px-3 py-2 space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-2/3" />
                  </div>
                ) : (
                  <ConversationNavGroup
                    conversations={conversations || []}
                    activeConversationId={activeConversationId}
                    onNewChat={handleNewChat}
                  />
                )}
              </SidebarContent>
              <SidebarFooter>
                <NavUser user={user} />
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
              {/* God impersonation banner - shows when viewing as an owner */}
              <ImpersonationBanner />

              <Header fixed className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="ml-auto flex items-center gap-2">
                  <ThemeSwitch />
                  <AgentBuilder
                    open={agentBuilderOpen}
                    onOpenChange={setAgentBuilderOpen}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Settings2 className="h-5 w-5" />
                      </Button>
                    }
                  />
                </div>
              </Header>
              {children ?? <Outlet />}
            </SidebarInset>
          </LayoutProvider>
        </SidebarProvider>
      </SearchProvider>
    </AuthGuard>
  )
}
