"use client"

import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Newspaper, Users, Calendar } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/community')({
  component: CommunityLayout
})

function CommunityLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Determine active tab based on current path
  const getActiveTab = () => {
    const path = location.pathname
    if (path === '/community' || path === '/community/feed' || path.startsWith('/community/feed/')) return 'feed'
    if (path === '/community/chat') return 'chat'
    if (path === '/community/events') return 'events'
    if (path === '/community/members') return 'members'
    return 'feed' // default
  }

  const activeTab = getActiveTab()

  const handleTabChange = (value: string) => {
    const routes: Record<string, string> = {
      feed: '/community/feed',
      chat: '/community/chat',
      events: '/community/events',
      members: '/community/members'
    }
    navigate({ to: routes[value] })
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header with Tabs */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community</h1>
          <p className="text-muted-foreground mt-2">Connect, share, and engage with others</p>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="feed" className="gap-2">
              <Newspaper className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Members</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <Outlet />
    </div>
  )
}

