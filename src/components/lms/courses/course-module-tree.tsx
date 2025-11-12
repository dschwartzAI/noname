"use client"

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, PlayCircle, Clock, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SelectModule, SelectLesson } from '@/database/schema/courses'

interface ModuleWithLessons extends SelectModule {
  lessons: SelectLesson[]
}

interface CourseModuleTreeProps {
  modules: ModuleWithLessons[]
  completedLessons?: string[]
  onLessonClick: (lessonId: string) => void
  currentLessonId?: string
}

export function CourseModuleTree({ 
  modules, 
  completedLessons = [],
  onLessonClick,
  currentLessonId
}: CourseModuleTreeProps) {
  const [expandedModules, setExpandedModules] = useState<string[]>([])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const getModuleProgress = (module: ModuleWithLessons) => {
    if (!module.lessons.length) return { completed: 0, total: 0, percentage: 0 }
    
    const completed = module.lessons.filter(lesson => 
      completedLessons.includes(lesson.id)
    ).length
    
    return {
      completed,
      total: module.lessons.length,
      percentage: Math.round((completed / module.lessons.length) * 100)
    }
  }

  return (
    <div className="space-y-4">
      <Accordion 
        type="multiple" 
        value={expandedModules}
        onValueChange={setExpandedModules}
        className="space-y-4"
      >
        {modules
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((module, moduleIndex) => {
            const progress = getModuleProgress(module)
            const isModuleComplete = progress.percentage === 100

            return (
              <AccordionItem 
                key={module.id} 
                value={module.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline hover:bg-accent px-4 py-4">
                  <div className="flex items-center gap-4 text-left flex-1">
                    {/* Module Number */}
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold shrink-0">
                      {moduleIndex + 1}
                    </div>

                    {/* Module Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base">{module.title}</h3>
                        {isModuleComplete && (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        )}
                      </div>
                      {module.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {module.description}
                        </p>
                      )}
                    </div>

                    {/* Progress Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="font-normal">
                        {progress.completed}/{progress.total} lessons
                      </Badge>
                      {progress.percentage > 0 && progress.percentage < 100 && (
                        <Badge variant="secondary" className="font-normal">
                          {progress.percentage}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 pt-2">
                    {module.lessons
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((lesson, lessonIndex) => {
                        const isCompleted = completedLessons.includes(lesson.id)
                        const isCurrent = currentLessonId === lesson.id
                        const isLocked = !lesson.published

                        return (
                          <Card
                            key={lesson.id}
                            className={cn(
                              "transition-all cursor-pointer hover:bg-accent",
                              isCurrent && "ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-950/20",
                              isLocked && "opacity-60 cursor-not-allowed"
                            )}
                            onClick={() => !isLocked && onLessonClick(lesson.id)}
                          >
                            <CardContent className="flex items-center gap-3 py-3">
                              {/* Status Icon */}
                              <div className="shrink-0">
                                {isLocked ? (
                                  <Lock className="h-5 w-5 text-muted-foreground" />
                                ) : isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>

                              {/* Lesson Number */}
                              <span className="text-sm font-medium text-muted-foreground w-6">
                                {lessonIndex + 1}
                              </span>

                              {/* Lesson Info */}
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-medium",
                                  isCompleted && "text-muted-foreground",
                                  isCurrent && "text-blue-600 font-semibold"
                                )}>
                                  {lesson.title}
                                </p>
                                {lesson.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                    {lesson.description}
                                  </p>
                                )}
                              </div>

                              {/* Duration */}
                              {lesson.duration && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(lesson.duration)}
                                </div>
                              )}

                              {/* Play Icon */}
                              {!isLocked && (
                                <PlayCircle className={cn(
                                  "h-5 w-5 shrink-0",
                                  isCurrent ? "text-blue-600" : "text-muted-foreground"
                                )} />
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
      </Accordion>
    </div>
  )
}

