import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Code,
  Eye,
  Copy,
  Download,
  X,
  FileCode,
  FileText,
  Image,
  BarChart3,
  Globe,
  Palette,
  ChevronLeft,
  ChevronRight
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
  className
}: ArtifactSidePanelProps) {
  const [activeTab, setActiveTab] = useState('preview')
  const artifact = artifacts[currentIndex]
  const hasMultiple = artifacts.length > 1

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
                {artifact.type}
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

      {/* Content */}
      <div className='flex-1 overflow-hidden'>
        <Tabs value={activeTab} onValueChange={setActiveTab} className='h-full flex flex-col'>
          <div className='px-4 pt-3'>
            <TabsList className='grid w-full max-w-md grid-cols-2'>
              <TabsTrigger value='preview' className='flex items-center gap-2'>
                <Eye className='h-4 w-4' />
                Preview
              </TabsTrigger>
              <TabsTrigger value='code' className='flex items-center gap-2'>
                <Code className='h-4 w-4' />
                Code
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value='preview' className='flex-1 mt-3 px-4 pb-4 overflow-hidden'>
            <ScrollArea className='h-full w-full'>
              {renderPreview()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value='code' className='flex-1 mt-3 px-4 pb-4 overflow-hidden'>
            <ScrollArea className='h-full w-full'>
              <SyntaxHighlighter
                language={getLanguageForHighlighting(artifact.type, artifact.language)}
                style={vscDarkPlus}
                className='rounded-lg'
                customStyle={{ margin: 0, fontSize: '14px' }}
              >
                {artifact.content}
              </SyntaxHighlighter>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
