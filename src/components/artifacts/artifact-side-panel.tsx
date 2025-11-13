import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Copy,
  Download,
  X,
  Code,
  FileCode,
  FileText,
  Image,
  BarChart3,
  Globe,
  Palette,
  ChevronLeft,
  ChevronRight,
  Edit,
  Save,
  X as CancelIcon
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Artifact } from '@/types/artifacts'
import { cn } from '@/lib/utils'
import { Response } from '@/components/response'

interface ArtifactSidePanelProps {
  artifacts: Artifact[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onArtifactUpdate?: (artifact: Artifact) => void
  conversationId?: string
  messageId?: string
  className?: string
}

const getArtifactIcon = (type: string) => {
  switch (type) {
    case 'code':
    case 'javascript':
    case 'typescript':
      return <FileCode className='h-5 w-5' />
    case 'react-component':
      return <Code className='h-5 w-5' />
    case 'html':
      return <Globe className='h-5 w-5' />
    case 'css':
      return <Palette className='h-5 w-5' />
    case 'svg':
      return <Image className='h-5 w-5' />
    case 'chart':
      return <BarChart3 className='h-5 w-5' />
    case 'markdown':
    case 'document':
      return <FileText className='h-5 w-5' />
    default:
      return <FileCode className='h-5 w-5' />
  }
}

const getArtifactLabel = (type: string) => {
  switch (type) {
    case 'markdown':
    case 'document':
      return 'Document'
    case 'code':
      return 'Code'
    case 'react-component':
      return 'React'
    case 'javascript':
      return 'JavaScript'
    case 'typescript':
      return 'TypeScript'
    case 'html':
      return 'HTML'
    case 'css':
      return 'CSS'
    case 'svg':
      return 'SVG'
    case 'chart':
      return 'Chart'
    default:
      return type
  }
}

const getLanguageForHighlighting = (type: string, language?: string) => {
  if (language) return language

  switch (type) {
    case 'javascript':
      return 'javascript'
    case 'typescript':
      return 'typescript'
    case 'react-component':
      return 'tsx'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    case 'markdown':
      return 'markdown'
    case 'svg':
      return 'xml'
    default:
      return 'text'
  }
}

export function ArtifactSidePanel({
  artifacts,
  currentIndex,
  onIndexChange,
  onClose,
  onArtifactUpdate,
  conversationId,
  messageId,
  className
}: ArtifactSidePanelProps) {
  const artifact = artifacts[currentIndex]
  const hasMultiple = artifacts.length > 1
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(artifact.content)
  const [isSaving, setIsSaving] = useState(false)

  // Update edited content when artifact changes
  useEffect(() => {
    setEditedContent(artifact.content)
    setIsEditing(false)
  }, [artifact])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content)
  }

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artifact.title}.${artifact.language || 'txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleEdit = () => {
    setEditedContent(artifact.content)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditedContent(artifact.content)
    setIsEditing(false)
  }

  const handleSave = async () => {
    // Enhanced logging to debug what's missing
    console.log('💾 Attempting to save artifact:', {
      conversationId,
      messageId,
      artifactId: artifact.id,
      artifactTitle: artifact.title,
      artifactMetadata: artifact.metadata,
      hasConversationId: !!conversationId,
      hasMessageId: !!messageId,
      hasArtifactId: !!artifact.id,
    })

    if (!conversationId || !messageId || !artifact.id) {
      console.error('❌ Missing required IDs for saving artifact:', {
        conversationId: conversationId || 'MISSING',
        messageId: messageId || 'MISSING',
        artifactId: artifact.id || 'MISSING',
        artifact: artifact,
      })

      // More specific error message
      const missing = []
      if (!conversationId) missing.push('conversation ID')
      if (!messageId) missing.push('message ID')
      if (!artifact.id) missing.push('artifact ID')

      alert(`Unable to save: Missing ${missing.join(', ')}. Please try refreshing the page.`)
      return
    }

    setIsSaving(true)
    try {
      // Use artifact.id as toolCallId (it should be the toolCallId from the message parts)
      const toolCallId = artifact.id
      
      const requestBody = {
        conversationId,
        messageId,
        toolCallId,
        content: editedContent,
      }

      console.log('💾 Saving artifact:', {
        ...requestBody,
        artifactId: artifact.id,
        artifactTitle: artifact.title,
        contentLength: editedContent.length,
      })

      const response = await fetch('/api/v1/chat/artifact', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      })

      const responseData = await response.json().catch(() => ({ error: 'Failed to parse response' }))

      if (!response.ok) {
        console.error('❌ Save artifact failed:', {
          status: response.status,
          statusText: response.statusText,
          responseData,
        })
        throw new Error(responseData.error || `Failed to save artifact: ${response.status}`)
      }

      console.log('✅ Artifact saved successfully:', responseData)

      // Update the artifact in the parent component
      const updatedArtifact = {
        ...artifact,
        content: editedContent,
        updatedAt: Date.now(),
      }

      if (onArtifactUpdate) {
        onArtifactUpdate(updatedArtifact)
      }

      setIsEditing(false)
    } catch (error) {
      console.error('❌ Error saving artifact:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save artifact. Please try again.'
      alert(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < artifacts.length - 1) {
      onIndexChange(currentIndex + 1)
    }
  }

  const renderPreview = () => {
    switch (artifact.type) {
      case 'html':
        return (
          <div className='border rounded-lg bg-white dark:bg-gray-900 h-full'>
            <iframe
              srcDoc={artifact.content}
              className='w-full h-full border-0 rounded-lg'
              sandbox='allow-scripts allow-same-origin'
              title={artifact.title}
            />
          </div>
        )

      case 'react-component':
        return (
          <div className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              React component preview (code only - execution requires proper setup)
            </p>
            <SyntaxHighlighter
              language='tsx'
              style={vscDarkPlus}
              className='rounded-lg'
              customStyle={{ margin: 0, fontSize: '14px' }}
            >
              {artifact.content}
            </SyntaxHighlighter>
          </div>
        )

      case 'svg':
        return (
          <div className='border rounded-lg p-4 bg-white dark:bg-gray-900 flex items-center justify-center h-full'>
            <div dangerouslySetInnerHTML={{ __html: artifact.content }} />
          </div>
        )

      case 'markdown':
      case 'document':
        return (
          <div className='prose dark:prose-invert max-w-none'>
            <Response enableCodeBlocks={true}>{artifact.content}</Response>
          </div>
        )

      default:
        return (
          <SyntaxHighlighter
            language={getLanguageForHighlighting(artifact.type, artifact.language)}
            style={vscDarkPlus}
            className='rounded-lg'
            customStyle={{ margin: 0, fontSize: '14px' }}
          >
            {artifact.content}
          </SyntaxHighlighter>
        )
    }
  }

  return (
    <div className={cn('flex flex-col h-full bg-background border-l animate-in slide-in-from-right duration-300', className)}>
      {/* Sticky Header */}
      <div className='sticky top-0 z-10 bg-background border-b p-4 space-y-3'>
        <div className='flex items-start justify-between'>
          <div className='space-y-2 flex-1 min-w-0'>
            <div className='flex items-center gap-3'>
              {getArtifactIcon(artifact.type)}
              <h3 className='text-lg font-semibold truncate'>{artifact.title}</h3>
              <Badge variant='secondary' className='text-xs shrink-0'>
                {getArtifactLabel(artifact.type)}
              </Badge>
            </div>
            {artifact.description && (
              <p className='text-sm text-muted-foreground line-clamp-2'>{artifact.description}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1'>
            {!isEditing && (
              <>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleCopy}
                  className='h-9 w-9 p-0'
                  title='Copy to clipboard'
                >
                  <Copy className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleDownload}
                  className='h-9 w-9 p-0'
                  title='Download'
                >
                  <Download className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleEdit}
                  className='h-9 w-9 p-0'
                  title='Edit artifact'
                >
                  <Edit className='h-4 w-4' />
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleSave}
                  disabled={isSaving}
                  className='h-9 w-9 p-0'
                  title='Save changes'
                >
                  <Save className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleCancel}
                  disabled={isSaving}
                  className='h-9 w-9 p-0'
                  title='Cancel editing'
                >
                  <CancelIcon className='h-4 w-4' />
                </Button>
              </>
            )}
          </div>

          <div className='flex items-center gap-2'>
            {/* Navigation Controls */}
            {hasMultiple && (
              <div className='flex items-center gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className='h-9 w-9 p-0'
                  title='Previous artifact'
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-xs text-muted-foreground px-2'>
                  {currentIndex + 1} / {artifacts.length}
                </span>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleNext}
                  disabled={currentIndex === artifacts.length - 1}
                  className='h-9 w-9 p-0'
                  title='Next artifact'
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            )}

            <Button
              variant='ghost'
              size='sm'
              onClick={onClose}
              className='h-9 w-9 p-0'
              title='Close (ESC)'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>

      {/* Content - Preview or Edit */}
      <div className='flex-1 overflow-hidden px-4 py-4'>
        {isEditing ? (
          <ScrollArea className='h-full w-full'>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className='font-mono text-sm min-h-[400px] resize-none'
              placeholder='Edit artifact content...'
            />
          </ScrollArea>
        ) : (
          <ScrollArea className='h-full w-full'>
            {renderPreview()}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
