import { ArtifactPreviewCard } from './artifact-preview-card'
import { Response } from '@/components/response'
import type { ArtifactMessage } from '@/types/artifacts'

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

      {/* Artifact preview cards (no collapsible wrapper) */}
      {hasArtifacts && (
        <div className='border-t pt-3 space-y-3'>
          {message.artifacts!.map((artifact) => (
            <ArtifactPreviewCard
              key={artifact.id}
              artifact={artifact}
              onClick={() => onArtifactSelect?.(artifact.id)}
              isSelected={selectedArtifactId === artifact.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}