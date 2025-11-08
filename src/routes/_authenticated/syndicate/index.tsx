"use client"

import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, Calendar, MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/syndicate/')({
  component: SyndicateHome
})

function SyndicateHome() {
  const sections = [
    {
      icon: BookOpen,
      title: 'Classroom',
      description: 'Access courses, modules, and lessons',
      href: '/syndicate/classroom',
      color: 'text-blue-600'
    },
    {
      icon: Calendar,
      title: 'Calendar',
      description: 'View and manage events',
      href: '/syndicate/calendar',
      color: 'text-green-600'
    },
    {
      icon: MessageSquare,
      title: 'Message Board',
      description: 'Join community discussions',
      href: '/syndicate/board',
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Syndicate</h1>
        <p className="text-muted-foreground mt-2">Your learning and collaboration hub</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} to={section.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardHeader>
                <section.icon className={`h-8 w-8 mb-2 ${section.color}`} />
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
