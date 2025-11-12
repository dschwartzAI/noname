"use client"

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Users,
  GraduationCap,
  MessageSquare,
  Briefcase
} from 'lucide-react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { cn } from '@/lib/utils'
import { SelectCalendarEvent } from '@/database/schema/calendar'

interface MonthCalendarProps {
  events: SelectCalendarEvent[]
  onEventClick: (event: SelectCalendarEvent) => void
  onDateClick?: (date: Date) => void
  isAdmin?: boolean
}

const eventTypeIcons = {
  office_hours: Clock,
  meeting: Users,
  class: GraduationCap,
  event: CalendarIcon,
  deadline: MessageSquare
}

const eventTypeColors = {
  office_hours: 'bg-blue-500 text-white',
  meeting: 'bg-green-500 text-white',
  class: 'bg-purple-500 text-white',
  event: 'bg-orange-500 text-white',
  deadline: 'bg-red-500 text-white'
}

export function MonthCalendar({ events, onEventClick, onDateClick, isAdmin }: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return isSameDay(eventDate, day) && !event.cancelled
    })
  }

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold min-w-[200px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
          {isAdmin && onDateClick && (
            <Button onClick={() => onDateClick(new Date())}>
              + Add Event
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div
              key={day}
              className="bg-muted p-2 text-center text-sm font-semibold"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isDayToday = isToday(day)

            return (
              <div
                key={index}
                className={cn(
                  "bg-background min-h-[100px] p-2 relative",
                  !isCurrentMonth && "opacity-40",
                  isAdmin && onDateClick && "cursor-pointer hover:bg-accent",
                  isDayToday && "bg-blue-50 dark:bg-blue-950/20"
                )}
                onClick={() => {
                  if (isAdmin && onDateClick) {
                    onDateClick(day)
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDayToday && "bg-blue-600 text-white h-6 w-6 rounded-full flex items-center justify-center"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const Icon = eventTypeIcons[event.type as keyof typeof eventTypeIcons]
                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1 rounded text-xs truncate flex items-center gap-1",
                          eventTypeColors[event.type as keyof typeof eventTypeColors],
                          "hover:opacity-80 transition-opacity"
                        )}
                      >
                        {Icon && <Icon className="h-3 w-3 shrink-0" />}
                        <span className="truncate">
                          {format(new Date(event.startTime), 'h:mm a')} {event.title}
                        </span>
                      </button>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground px-2">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="text-muted-foreground">Office Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">Meeting</span>
        </div>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-purple-500" />
          <span className="text-muted-foreground">Class</span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-orange-500" />
          <span className="text-muted-foreground">Event</span>
        </div>
      </div>
    </div>
  )
}

