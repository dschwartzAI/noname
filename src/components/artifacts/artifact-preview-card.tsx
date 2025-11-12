import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import {
  Code,
  FileCode,
  FileText,
  Image,
  BarChart3,
  Globe,
  Palette
} from 'lucide-react'
import type { Artifact } from '@/types/artifacts'
import { cn } from '@/lib/utils'

interface ArtifactPreviewCardProps {
  artifact: Artifact
  onClick: () => void
  isSelected?: boolean
}

const getArtifactIcon = (type: string) => {
  switch (type) {
    case 'code':
    case 'javascript':
    case 'typescript':
      return <FileCode className='h-4 w-4' />
    case 'react-component':
      return <Code className='h-4 w-4' />
    case 'html':
      return <Globe className='h-4 w-4' />
    case 'css':
      return <Palette className='h-4 w-4' />
    case 'svg':
      return <Image className='h-4 w-4' />
    case 'chart':
      return <BarChart3 className='h-4 w-4' />
    case 'markdown':
    case 'document':
      return <FileText className='h-4 w-4' />
    default:
      return <FileCode className='h-4 w-4' />
  }
}


export function ArtifactPreviewCard({ artifact, onClick, isSelected }: ArtifactPreviewCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        isSelected && 'border-primary shadow-md bg-primary/5'
      )}
      onClick={onClick}
    >
      <div className='p-4'>
        <div className='flex items-start gap-3'>
          <div className='mt-1 text-muted-foreground'>
            {getArtifactIcon(artifact.type)}
          </div>

          <div className='flex-1 min-w-0 space-y-2'>
            <div className='flex items-center gap-2'>
              <h4 className='font-medium text-sm truncate'>{artifact.title}</h4>
              <Badge variant='secondary' className='text-xs shrink-0'>
                {artifact.type}
              </Badge>
            </div>

            {artifact.description && (
              <p className='text-xs text-muted-foreground line-clamp-2'>
                {artifact.description}
              </p>
            )}
          </div>

          <div className='text-muted-foreground shrink-0 mt-1'>
            <ChevronRight className='h-4 w-4' />
          </div>
        </div>
      </div>
    </Card>
  )
}
