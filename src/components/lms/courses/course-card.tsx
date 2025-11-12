"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Clock, Users, PlayCircle, CheckCircle2 } from 'lucide-react'
import { SelectCourse } from '@/database/schema/courses'

interface CourseCardProps {
  course: SelectCourse
  moduleCount?: number
  lessonCount?: number
  totalDuration?: number
  enrollment?: {
    progressPercentage: number
    completedLessons: string[]
    lastAccessedAt: Date
  }
  onClick: () => void
}

export function CourseCard({ 
  course, 
  moduleCount = 0,
  lessonCount = 0, 
  totalDuration = 0,
  enrollment,
  onClick 
}: CourseCardProps) {
  const isEnrolled = !!enrollment
  const isCompleted = enrollment && enrollment.progressPercentage === 100

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col" 
      onClick={(e) => {
        // Only trigger if not clicking the button
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        onClick()
      }}
    >
      {/* Thumbnail */}
      {course.thumbnail && (
        <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
          <img 
            src={course.thumbnail} 
            alt={course.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          />
          {isCompleted && (
            <div className="absolute top-3 right-3 bg-green-600 text-white rounded-full p-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          )}
          {!isEnrolled && course.tier === 'pro' && (
            <Badge className="absolute top-3 left-3" variant="default">
              Pro
            </Badge>
          )}
        </div>
      )}

      <CardHeader className="pb-3 flex-grow">
        <div className="space-y-2">
          <CardTitle className="line-clamp-2 group-hover:text-blue-600 transition-colors">
            {course.title}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
          
          {/* Instructor */}
          <div className="flex items-center gap-2 pt-2">
            {course.instructorAvatar ? (
              <img 
                src={course.instructorAvatar} 
                alt={course.instructor} 
                className="h-6 w-6 rounded-full"
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

      <CardContent className="space-y-3 pb-6">
        {/* Progress Bar (if enrolled) */}
        {isEnrolled && enrollment && (
          <div className="space-y-2">
            <Progress value={enrollment.progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {enrollment.progressPercentage}% complete
            </p>
          </div>
        )}

        {/* Course Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {moduleCount} modules
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle className="h-4 w-4" />
            {lessonCount} lessons
          </span>
        </div>

        {totalDuration > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDuration(totalDuration)}
          </div>
        )}

        {course.enrollmentCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {course.enrollmentCount} enrolled
          </div>
        )}

        {/* CTA Button */}
        <Button 
          className="w-full mt-4" 
          variant={isEnrolled ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        >
          {isCompleted ? 'Review Course' : isEnrolled ? 'Continue Learning' : 'Start Course'}
        </Button>
      </CardContent>
    </Card>
  )
}

