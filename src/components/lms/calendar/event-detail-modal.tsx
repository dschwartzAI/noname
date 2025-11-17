"use client"

import { format } from 'date-fns'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Repeat,
  Users,
  Download,
  Trash2
} from 'lucide-react'
import { SelectCalendarEvent } from '@/database/schema/calendar'

interface EventDetailModalProps {
  event: SelectCalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (event: SelectCalendarEvent) => void
  onDelete?: (eventId: string, deleteType?: 'single' | 'series', instanceDate?: string) => void
  isAdmin?: boolean
}

const eventTypeLabels = {
  office_hours: 'Office Hours',
  meeting: 'Meeting',
  class: 'Class',
  event: 'Event',
  deadline: 'Deadline'
}

export function EventDetailModal({ 
  event, 
  isOpen, 
  onClose, 
  onEdit,
  onDelete,
  isAdmin 
}: EventDetailModalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteType, setDeleteType] = useState<'single' | 'series'>('series')

  if (!event) return null

  const startDate = new Date(event.startTime)
  const endDate = new Date(event.endTime)
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
  
  // Check if this is a recurring instance (has originalEventId)
  const isRecurringInstance = !!(event as any).isRecurringInstance && !!(event as any).originalEventId

  const handleAddToCalendar = () => {
    // Generate .ics file
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LMS Calendar//EN
BEGIN:VEVENT
UID:${event.id}
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss'Z'")}
DTEND:${format(endDate, "yyyyMMdd'T'HHmmss'Z'")}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
${event.meetingUrl ? `URL:${event.meetingUrl}` : ''}
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.title.replace(/\s+/g, '-')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{event.title}</DialogTitle>
              <Badge variant="outline" className="mt-2">
                {eventTypeLabels[event.type as keyof typeof eventTypeLabels]}
              </Badge>
            </div>
            {isAdmin && onEdit && (
              <Button variant="outline" onClick={() => onEdit(event)}>
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{format(startDate, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-muted-foreground">
                {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{duration} minutes</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <span className="text-sm">{event.location}</span>
            </div>
          )}

          {/* Meeting Link */}
          {event.meetingUrl && (
            <div className="flex items-start gap-3">
              <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
              <a 
                href={event.meetingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Join Meeting
              </a>
            </div>
          )}

          {/* Recurrence */}
          {event.recurring && event.recurrenceRule && (
            <div className="flex items-start gap-3">
              <Repeat className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Recurring Event</p>
                <p className="text-muted-foreground">
                  {event.recurrenceRule.frequency === 'weekly' && 'Every week'}
                  {event.recurrenceRule.frequency === 'monthly' && 'Every month'}
                  {event.recurrenceRule.frequency === 'daily' && 'Every day'}
                  {event.recurrenceRule.daysOfWeek && event.recurrenceRule.daysOfWeek.length > 0 && (
                    <span> on {
                      event.recurrenceRule.daysOfWeek.map(d => 
                        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
                      ).join(', ')
                    }</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-4 border-t">
              <p className="font-medium mb-2">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Visibility */}
          {event.visibility !== 'organization' && (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">
                {event.visibility === 'public' ? 'Public' : 'Private'}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-between pt-4 border-t">
          <div className="flex gap-2">
            {isAdmin && onDelete && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddToCalendar}>
              <Download className="h-4 w-4 mr-2" />
              Add to Calendar
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              {event.recurring || isRecurringInstance ? (
                <div className="space-y-4">
                  <p>This is a recurring event. What would you like to delete?</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteType"
                        value="single"
                        checked={deleteType === 'single'}
                        onChange={() => setDeleteType('single')}
                        className="w-4 h-4"
                      />
                      <span>Just this occurrence</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteType"
                        value="series"
                        checked={deleteType === 'series'}
                        onChange={() => setDeleteType('series')}
                        className="w-4 h-4"
                      />
                      <span>All occurrences (entire series)</span>
                    </label>
                  </div>
                </div>
              ) : (
                <p>Are you sure you want to delete this event? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onDelete) {
                  const eventId = isRecurringInstance ? (event as any).originalEventId : event.id
                  const instanceDate = deleteType === 'single' ? startDate.toISOString() : undefined
                  onDelete(eventId, deleteType, instanceDate)
                }
                setShowDeleteDialog(false)
                onClose()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

