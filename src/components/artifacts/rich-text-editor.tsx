"use client"

import { useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Bold, Italic, Heading1, Heading2, Heading3 } from 'lucide-react'
import { markdownToHtml, htmlToMarkdown } from '@/lib/markdown-utils'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  className?: string
}

export function RichTextEditor({ content, onChange, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)
  const lastContentRef = useRef<string>('')
  const isInitializedRef = useRef(false)

  // Initialize editor with HTML content on mount
  useEffect(() => {
    if (!editorRef.current || isInitializedRef.current) return
    
    const html = markdownToHtml(content)
    editorRef.current.innerHTML = html
    lastContentRef.current = content
    isInitializedRef.current = true
  }, [content])

  // Update editor when content changes externally
  useEffect(() => {
    if (!editorRef.current || !isInitializedRef.current) return
    
    // Only update if content actually changed from external source
    if (content === lastContentRef.current) return
    
    // Don't update if we're currently processing user input
    if (isUpdatingRef.current) return
    
    const html = markdownToHtml(content)
    const currentHtml = editorRef.current.innerHTML
    
    // Only update if HTML is different
    if (currentHtml !== html) {
      isUpdatingRef.current = true
      editorRef.current.innerHTML = html
      lastContentRef.current = content
      
      // Reset flag after React processes
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }, [content])

  const handleInput = useCallback(() => {
    if (!editorRef.current || isUpdatingRef.current) return
    
    const html = editorRef.current.innerHTML
    const markdown = htmlToMarkdown(html)
    
    // Only call onChange if markdown actually changed
    if (markdown !== lastContentRef.current) {
      isUpdatingRef.current = true
      lastContentRef.current = markdown
      onChange(markdown)
      
      // Reset flag after React processes
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }, [onChange])

  const execCommand = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return
    
    editorRef.current.focus()
    document.execCommand(command, false, value)
    
    // Small delay to ensure command is executed before converting
    setTimeout(() => {
      handleInput()
    }, 10)
  }, [handleInput])

  const formatHeader = useCallback((level: number) => {
    if (!editorRef.current) return
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      editorRef.current.focus()
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    
    if (selectedText) {
      // If text is selected, wrap it in a header
      const headerElement = document.createElement(`h${level}`)
      headerElement.textContent = selectedText
      range.deleteContents()
      range.insertNode(headerElement)
    } else {
      // If no selection, check if cursor is in a block element and convert it
      const container = range.commonAncestorContainer
      let element: HTMLElement | null = null

      if (container.nodeType === Node.TEXT_NODE) {
        element = container.parentElement
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        element = container as HTMLElement
      }

      if (element) {
        // Find the block element (p, div, h1-h6, etc.)
        while (element && element !== editorRef.current && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
          element = element.parentElement
        }

        if (element && element !== editorRef.current) {
          const headerElement = document.createElement(`h${level}`)
          headerElement.innerHTML = element.innerHTML
          element.parentNode?.replaceChild(headerElement, element)
          
          // Restore selection
          const newRange = document.createRange()
          newRange.selectNodeContents(headerElement)
          newRange.collapse(false) // Collapse to end
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      }
    }

    setTimeout(() => {
      handleInput()
    }, 10)
  }, [handleInput])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50 rounded-t-lg">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className="h-8 w-8 p-0"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className="h-8 w-8 p-0"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatHeader(1)}
          className="h-8 w-8 p-0"
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatHeader(2)}
          className="h-8 w-8 p-0"
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatHeader(3)}
          className="h-8 w-8 p-0"
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className={cn(
          'flex-1 prose dark:prose-invert max-w-none p-4',
          'focus:outline-none overflow-y-auto',
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6',
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5',
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4',
          '[&_strong]:font-bold',
          '[&_em]:italic',
          '[&_br]:block',
          'min-h-[400px]'
        )}
        suppressContentEditableWarning
      />
    </div>
  )
}

