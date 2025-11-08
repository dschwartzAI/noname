"use client"

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar as CalendarIcon, Clock, MapPin, Video } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export const Route = createFileRoute('/_authenticated/syndicate/calendar')({
  component: CalendarPage
})

function CalendarPage() {
  const now = new Date()
  const startDate = startOfMonth(now).toISOString()
  const endDate = endOfMonth(now).toISOString()

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/v1/calendar?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    }
  })

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    )
  }

  const events = data?.events || []
  const typeColors: Record<string, string> = {
    meeting: 'bg-blue-500',
    class: 'bg-green-500',
    deadline: 'bg-red-500',
    event: 'bg-purple-500',
    office_hours: 'bg-yellow-500'
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground mt-2">{format(now, 'MMMM yyyy')}</p>
      </div>

      <div className="space-y-4">
        {events.map((item: any) => {
          const event = item.event
          return (
            <Card key={event.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-1 h-full rounded ${typeColors[event.type] || 'bg-gray-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <Badge variant="outline">{event.type}</Badge>
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {format(new Date(event.startTime), 'PPp')} - {format(new Date(event.endTime), 'p')}
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </div>
                )}
                {event.meetingUrl && (
                  <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Video className="h-4 w-4" />
                    Join Meeting
                  </a>
                )}
              </CardContent>
            </Card>
          )
        })}
        {events.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events this month</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
