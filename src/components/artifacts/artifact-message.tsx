import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { ArtifactPreviewCard } from './artifact-preview-card'
import { Response } from '@/components/response'
import type { ArtifactMessage } from '@/types/artifacts'
import { useState } from 'react'

interface ArtifactMessageProps {
  message: ArtifactMessage
  onArtifactSelect?: (artifactId: string) => void
  selectedArtifactId?: string
  onEditArtifact?: (artifact: any) => void
  onDeleteArtifact?: (id: string) => void
}

export function ArtifactMessageComponent({
  message,
  onArtifactSelect,
  selectedArtifactId,
  onEditArtifact,
  onDeleteArtifact
}: ArtifactMessageProps) {
  const [artifactsExpanded, setArtifactsExpanded] = useState(true)
  const hasArtifacts = message.artifacts && message.artifacts.length > 0

  // Remove code blocks from content if artifacts exist (prevent duplication)
  let displayContent = message.content
  if (hasArtifacts) {
    // Remove markdown code blocks (```...```)
    displayContent = displayContent.replace(/```[\s\S]*?```/g, '').trim()
  }

  return (
    <div className='space-y-3'>
      {/* Message content (without code blocks if artifacts exist) */}
      {displayContent && (
        <div>
          <Response enableCodeBlocks={!hasArtifacts}>{displayContent}</Response>
        </div>
      )}

      {/* Artifacts section */}
      {hasArtifacts && (
        <div className='border-t pt-3'>
          <Collapsible open={artifactsExpanded} onOpenChange={setArtifactsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='flex items-center gap-2 p-0 h-auto font-medium'>
                {artifactsExpanded ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
                <Sparkles className='h-4 w-4 text-purple-500' />
                <span>Artifacts</span>
                <Badge variant='secondary' className='text-xs'>
                  {message.artifacts!.length}
                </Badge>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className='mt-3 space-y-3'>
              {message.artifacts!.map((artifact) => (
                <ArtifactPreviewCard
                  key={artifact.id}
                  artifact={artifact}
                  onClick={() => onArtifactSelect?.(artifact.id)}
                  isSelected={selectedArtifactId === artifact.id}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  )
}