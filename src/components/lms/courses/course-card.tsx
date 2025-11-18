"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SelectCourse } from '@/database/schema/courses'

interface CourseCardProps {
  course: SelectCourse
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
}

export function CourseCard({ 
  course, 
  onClick,
  onEdit,
  onDelete,
  canEdit = false
}: CourseCardProps) {
  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col" 
      onClick={(e) => {
        // Only trigger if not clicking the button or dropdown
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]')) {
          return
        }
        onClick()
      }}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-48 overflow-hidden rounded-t-lg bg-muted">
        {course.thumbnail ? (
          <img 
            key={course.thumbnail} // Force re-render when thumbnail changes
            src={course.thumbnail} 
            alt={course.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // If image fails to load, hide it and show placeholder
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const placeholder = target.parentElement?.querySelector('.thumbnail-placeholder') as HTMLElement
              if (placeholder) {
                placeholder.style.display = 'flex'
              }
            }}
          />
        ) : null}
        <div 
          className={`thumbnail-placeholder w-full h-full flex items-center justify-center text-muted-foreground ${course.thumbnail ? 'hidden' : ''}`}
        >
          No Image
        </div>
        
        {/* Edit Button */}
        {canEdit && (
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.() }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Course
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete?.() }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Course
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CardHeader className="pb-3 flex-grow">
        <div className="space-y-2">
          <CardTitle className="line-clamp-2 group-hover:text-foreground transition-colors font-medium group-hover:font-semibold">
            {course.title}
          </CardTitle>
          
          {/* Instructor */}
          <div className="flex items-center gap-2 pt-2">
            {course.instructorAvatar ? (
              <img 
                src={course.instructorAvatar} 
                alt={course.instructor} 
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                {course.instructor.charAt(0)}
              </div>
            )}
            <span className="text-sm text-muted-foreground">{course.instructor}</span>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

