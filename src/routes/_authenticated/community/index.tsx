"use client"

import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MessageSquare, Newspaper, Users, Calendar } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/community/')({
  component: CommunityHome
})

function CommunityHome() {
  const sections = [
    {
      icon: MessageSquare,
      title: 'Chat',
      description: 'Real-time messaging with the community',
      href: '/community/chat',
      color: 'text-blue-600',
      badge: 'Demo UI'
    },
    {
      icon: Newspaper,
      title: 'Feed',
      description: 'Community posts, discussions, and Q&A',
      href: '/community/feed',
      color: 'text-purple-600'
    },
    {
      icon: Users,
      title: 'Members',
      description: 'Browse community members',
      href: '/community', // Will be /community/members when built
      color: 'text-green-600',
      badge: 'Coming Soon'
    },
    {
      icon: Calendar,
      title: 'Events',
      description: 'Community calendar and activities',
      href: '/community/events',
      color: 'text-orange-600'
    }
  ]

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground mt-2">Connect, share, and engage with others</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} to={section.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <section.icon className={`h-8 w-8 mb-2 ${section.color}`} />
                  {section.badge && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {section.badge}
                    </span>
                  )}
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Stats or Featured Content */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Welcome to the Community! 👋</CardTitle>
          <CardDescription className="space-y-2">
            <p>This is your hub for connecting with other members. Here you can:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Chat</strong> - Have real-time conversations (coming soon)</li>
              <li><strong>Feed</strong> - Share posts, ask questions, and engage in discussions</li>
              <li><strong>Members</strong> - Discover and connect with community members (coming soon)</li>
              <li><strong>Events</strong> - Stay updated on upcoming community activities</li>
            </ul>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
