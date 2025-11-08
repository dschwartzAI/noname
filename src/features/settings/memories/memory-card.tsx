import { Edit, Trash2, Brain, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Memory } from '@/../database/schema/memories'

type MemoryCardProps = {
  memory: Memory
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}

export function MemoryCard({ memory, onEdit, onDelete, disabled }: MemoryCardProps) {
  const getSourceIcon = () => {
    switch (memory.source) {
      case 'auto':
        return <Brain className="h-3 w-3" />
      case 'agent':
        return <User className="h-3 w-3" />
      default:
        return null
    }
  }

  const getSourceLabel = () => {
    switch (memory.source) {
      case 'auto':
        return 'Auto-learned'
      case 'agent':
        return 'Agent'
      case 'manual':
        return 'Manual'
      default:
        return 'Unknown'
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{memory.key}</h4>
              <Badge variant="outline" className="text-xs">
                {getSourceIcon()}
                <span className="ml-1">{getSourceLabel()}</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{memory.value}</p>
            <p className="text-xs text-muted-foreground">
              Created: {new Date(memory.createdAt).toLocaleDateString()}
              {memory.updatedAt && memory.updatedAt !== memory.createdAt && (
                <> • Updated: {new Date(memory.updatedAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              disabled={disabled}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
