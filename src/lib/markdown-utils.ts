/**
 * Simple markdown to HTML converter for basic formatting
 * Supports: bold, italic, headers (h1-h6)
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown

  // Split by lines to process headers properly
  const lines = html.split('\n')
  const processedLines: string[] = []

  for (const line of lines) {
    // Check for headers (must be at start of line)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const text = headerMatch[2]
      processedLines.push(`<h${level}>${text}</h${level}>`)
    } else {
      // Process inline formatting for non-header lines
      let processedLine = line
      
      // Convert bold (**text** or __text__)
      processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      processedLine = processedLine.replace(/__([^_]+)__/g, '<strong>$1</strong>')
      
      // Convert italic (*text* or _text_)
      processedLine = processedLine.replace(/\*([^*]+)\*/g, '<em>$1</em>')
      processedLine = processedLine.replace(/_([^_]+)_/g, '<em>$1</em>')
      
      // Wrap in paragraph if not empty
      if (processedLine.trim()) {
        processedLines.push(`<p>${processedLine}</p>`)
      } else {
        processedLines.push('<br>')
      }
    }
  }

  return processedLines.join('')
}

/**
 * Simple HTML to markdown converter for basic formatting
 * Supports: bold, italic, headers (h1-h6)
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''

  let markdown = html

  // Convert headers (h1-h6) - must be done first, but preserve nested formatting
  markdown = markdown.replace(/<h([1-6])>(.*?)<\/h[1-6]>/gi, (_, level, text) => {
    const hashes = '#'.repeat(parseInt(level))
    // Process nested formatting in headers
    let headerText = text
    headerText = headerText.replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    headerText = headerText.replace(/<b>(.*?)<\/b>/gi, '**$1**')
    headerText = headerText.replace(/<em>(.*?)<\/em>/gi, '*$1*')
    headerText = headerText.replace(/<i>(.*?)<\/i>/gi, '*$1*')
    headerText = headerText.replace(/<[^>]*>/g, '') // Remove any remaining tags
    return `\n${hashes} ${headerText}\n`
  })

  // Convert bold (strong and b tags)
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**')

  // Convert italic (em and i tags)
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*')

  // Convert paragraphs to line breaks
  markdown = markdown.replace(/<p>/gi, '')
  markdown = markdown.replace(/<\/p>/gi, '\n')

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

  // Remove any remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Clean up extra whitespace and line breaks
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.replace(/[ \t]+/g, ' ') // Multiple spaces to single space
  markdown = markdown.trim()

  return markdown
}

