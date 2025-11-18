"use client"

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectCalendarEvent, InsertCalendarEvent } from '@/database/schema/calendar'

interface EventFormModalProps {
  event?: SelectCalendarEvent | null
  defaultDate?: Date
  isOpen: boolean
  onClose: () => void
  onSave: (event: Partial<InsertCalendarEvent>) => Promise<void>
}

export function EventFormModal({ 
  event, 
  defaultDate,
  isOpen, 
  onClose,
  onSave
}: EventFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    type: event?.type || 'event',
    startTime: event?.startTime 
      ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm")
      : defaultDate 
        ? format(defaultDate, "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: 60,
    location: event?.location || '',
    meetingUrl: event?.meetingUrl || '',
    recurring: event?.recurring || false,
    frequency: event?.recurrenceRule?.frequency || 'weekly',
    interval: event?.recurrenceRule?.interval || 1,
    daysOfWeek: event?.recurrenceRule?.daysOfWeek || [],
    endsType: event?.recurrenceRule?.until ? 'date' : 'never', // 'never' or 'date'
    endsOn: event?.recurrenceRule?.until 
      ? format(new Date(event.recurrenceRule.until), "yyyy-MM-dd")
      : '',
    visibility: event?.visibility || 'organization',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const startTime = new Date(formData.startTime)
      const endTime = new Date(startTime.getTime() + formData.duration * 60 * 1000)

      const eventData: Partial<InsertCalendarEvent> = {
        title: formData.title,
        description: formData.description || null,
        type: formData.type as any,
        startTime,
        endTime,
        location: formData.location || null,
        meetingUrl: formData.meetingUrl || null,
        recurring: formData.recurring,
        recurrenceRule: formData.recurring ? {
          frequency: formData.frequency as 'daily' | 'weekly' | 'monthly',
          interval: formData.interval,
          daysOfWeek: formData.daysOfWeek,
          until: formData.endsType === 'date' && formData.endsOn 
            ? new Date(formData.endsOn).toISOString()
            : undefined,
        } : undefined,
        visibility: formData.visibility as 'public' | 'private' | 'organization',
      }

      await onSave(eventData)
      onClose()
    } catch (error) {
      console.error('Failed to save event:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day].sort()
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office_hours">Office Hours</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="class">Class</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Date & Time *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Physical location"
            />
          </div>

          {/* Meeting URL */}
          <div className="space-y-2">
            <Label htmlFor="meetingUrl">Meeting URL</Label>
            <Input
              id="meetingUrl"
              type="url"
              value={formData.meetingUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, meetingUrl: e.target.value }))}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          {/* Recurring */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={formData.recurring}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, recurring: checked as boolean }))
                }
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Recurring Event
              </Label>
            </div>

            {formData.recurring && (
              <div className="space-y-4 pl-6 border-l-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Every</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.interval}
                      onChange={(e) => setFormData(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {formData.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Repeat on</Label>
                    <div className="flex gap-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant={formData.daysOfWeek.includes(idx) ? 'default' : 'outline'}
                          size="sm"
                          className="w-10 h-10 p-0"
                          onClick={() => toggleDayOfWeek(idx)}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End Date Option */}
                <div className="space-y-4">
                  <Label>Ends</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="never"
                        name="endsType"
                        value="never"
                        checked={formData.endsType === 'never'}
                        onChange={(e) => setFormData(prev => ({ ...prev, endsType: 'never' }))}
                        className="cursor-pointer"
                      />
                      <Label htmlFor="never" className="cursor-pointer font-normal">
                        Never (continues indefinitely)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="endsOnDate"
                        name="endsType"
                        value="date"
                        checked={formData.endsType === 'date'}
                        onChange={(e) => setFormData(prev => ({ ...prev, endsType: 'date' }))}
                        className="cursor-pointer"
                      />
                      <Label htmlFor="endsOnDate" className="cursor-pointer font-normal">
                        On specific date
                      </Label>
                    </div>
                    {formData.endsType === 'date' && (
                      <div className="pl-6">
                        <Input
                          type="date"
                          value={formData.endsOn}
                          onChange={(e) => setFormData(prev => ({ ...prev, endsOn: e.target.value }))}
                          min={formData.startTime ? formData.startTime.split('T')[0] : undefined}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="organization">Organization Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

