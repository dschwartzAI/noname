"use client"

import { useCallback, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthCalendar } from '@/components/lms/calendar/month-calendar'
import { EventDetailModal } from '@/components/lms/calendar/event-detail-modal'
import { EventFormModal } from '@/components/lms/calendar/event-form-modal'
import { SelectCalendarEvent, InsertCalendarEvent } from '@/database/schema/calendar'
import { startOfMonth, endOfMonth } from 'date-fns'

export const Route = createFileRoute('/_authenticated/syndicate/calendar')({
  component: CalendarPage
})

function CalendarPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedEvent, setSelectedEvent] = useState<SelectCalendarEvent | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SelectCalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [visibleRange, setVisibleRange] = useState(() => {
    const today = new Date()
    return {
      startDate: startOfMonth(today).toISOString(),
      endDate: endOfMonth(today).toISOString()
    }
  })

  const handleVisibleRangeChange = useCallback(
    (range: { startDate: Date; endDate: Date }) => {
      setVisibleRange((prev) => {
        const nextStartDate = range.startDate.toISOString()
        const nextEndDate = range.endDate.toISOString()
        if (prev.startDate === nextStartDate && prev.endDate === nextEndDate) {
          return prev
        }
        return { startDate: nextStartDate, endDate: nextEndDate }
      })
    },
    []
  )

  // TODO: Replace with actual user data
  const isAdmin = true

  const { startDate, endDate } = visibleRange

  const { data, isLoading } = useQuery<{
    events: Array<{ event: SelectCalendarEvent; userRsvp?: string | null }>
  }>({
    queryKey: ['calendar-events', startDate, endDate],
    queryFn: async (): Promise<{
      events: Array<{ event: SelectCalendarEvent; userRsvp?: string | null }>
    }> => {
      try {
        const res = await fetch(`/api/v1/calendar?startDate=${startDate}&endDate=${endDate}`)
        if (!res.ok) throw new Error('API not available')
        return (await res.json()) as {
          events: Array<{ event: SelectCalendarEvent; userRsvp?: string | null }>
        }
      } catch (error) {
        // Use mock data if API is not available
        const { mockCalendarEvents } = await import('@/lib/mock-data/lms-mock-data')
        return {
          events: mockCalendarEvents
        } as {
          events: Array<{ event: SelectCalendarEvent; userRsvp?: string | null }>
        }
      }
    }
  })

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<InsertCalendarEvent>) => {
      const res = await fetch('/api/v1/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({ error: 'Failed to create event' }))) as {
          error?: string
        }
        console.error('Create event error:', error)
        throw new Error(error.error || 'Failed to create event')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setShowFormModal(false)
      setEditingEvent(null)
    }
  })

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<InsertCalendarEvent> }) => {
      const res = await fetch(`/api/v1/calendar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update event')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setShowFormModal(false)
      setEditingEvent(null)
    }
  })

  const handleEventClick = (event: SelectCalendarEvent) => {
    setSelectedEvent(event)
    setShowDetailModal(true)
  }

  const handleDateClick = (date: Date) => {
    if (!isAdmin) return
    setSelectedDate(date)
    setEditingEvent(null)
    setShowFormModal(true)
  }

  const handleEdit = (event: SelectCalendarEvent) => {
    setEditingEvent(event)
    setShowDetailModal(false)
    setShowFormModal(true)
  }

  const deleteEventMutation = useMutation({
    mutationFn: async ({ 
      id, 
      deleteType, 
      instanceDate 
    }: { 
      id: string
      deleteType?: 'single' | 'series'
      instanceDate?: string 
    }) => {
      const params = new URLSearchParams()
      if (deleteType) params.append('deleteType', deleteType)
      if (instanceDate) params.append('instanceDate', instanceDate)
      
      const res = await fetch(`/api/v1/calendar/${id}?${params.toString()}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({ error: 'Failed to delete event' }))) as {
          error?: string
        }
        throw new Error(error.error || 'Failed to delete event')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setShowDetailModal(false)
      setSelectedEvent(null)
    }
  })

  const handleSave = async (eventData: Partial<InsertCalendarEvent>) => {
    if (editingEvent) {
      await updateEventMutation.mutateAsync({ id: editingEvent.id, data: eventData })
    } else {
      await createEventMutation.mutateAsync(eventData)
    }
  }

  const handleDelete = (eventId: string, deleteType?: 'single' | 'series', instanceDate?: string) => {
    deleteEventMutation.mutate({ id: eventId, deleteType, instanceDate })
  }

  if (isLoading) {
    return (
      <div className="container max-w-7xl py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  const events = data?.events?.map((item: any) => item.event) || []

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/syndicate' })}
          className="h-auto p-0 hover:text-foreground"
        >
          Syndicate
        </Button>
        <span>/</span>
        <span className="font-medium text-foreground">Calendar</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground mt-2">View and manage your events</p>
      </div>

      <MonthCalendar 
        events={events}
        onEventClick={handleEventClick}
        onDateClick={isAdmin ? handleDateClick : undefined}
        isAdmin={isAdmin}
        onVisibleRangeChange={handleVisibleRangeChange}
      />

      <EventDetailModal
        event={selectedEvent}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onEdit={isAdmin ? handleEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <EventFormModal
          event={editingEvent}
          defaultDate={selectedDate}
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false)
            setEditingEvent(null)
            setSelectedDate(undefined)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
