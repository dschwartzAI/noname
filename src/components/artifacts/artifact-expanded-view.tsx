import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Palette
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Artifact } from '@/types/artifacts'
import { Response } from '@/components/response'

interface ArtifactExpandedViewProps {
  artifact: Artifact
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function ArtifactExpandedView({ artifact, open, onOpenChange }: ArtifactExpandedViewProps) {
  const [activeTab, setActiveTab] = useState('preview')

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className='p-6 pb-4 border-b'>
          <div className='flex items-start justify-between'>
            <div className='space-y-2 flex-1'>
              <div className='flex items-center gap-3'>
                {getArtifactIcon(artifact.type)}
                <DialogTitle className='text-xl'>{artifact.title}</DialogTitle>
                <Badge variant='secondary' className='text-xs'>
                  {artifact.type}
                </Badge>
              </div>
              {artifact.description && (
                <p className='text-sm text-muted-foreground'>{artifact.description}</p>
              )}
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleCopy}
                className='h-9 w-9 p-0'
                title="Copy to clipboard"
              >
                <Copy className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleDownload}
                className='h-9 w-9 p-0'
                title="Download"
              >
                <Download className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onOpenChange(false)}
                className='h-9 w-9 p-0'
                title="Close"
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className='flex-1 overflow-hidden'>
          <Tabs value={activeTab} onValueChange={setActiveTab} className='h-full flex flex-col'>
            <div className='px-6 pt-4'>
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

            <TabsContent value='preview' className='flex-1 mt-4 px-6 pb-6 overflow-hidden'>
              <ScrollArea className='h-full w-full'>
                {renderPreview()}
              </ScrollArea>
            </TabsContent>

            <TabsContent value='code' className='flex-1 mt-4 px-6 pb-6 overflow-hidden'>
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
      </DialogContent>
    </Dialog>
  )
}
