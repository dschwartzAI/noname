# Artifact System Guide

## Overview

The artifact system allows AI agents to create interactive, editable content that streams to a side panel for a better user experience. This guide explains how artifacts work, when to use them, and how to configure them.

## Artifact Types

### 1. **Document** (`kind: 'document'`)
- **Purpose**: Rich text documents (essays, articles, documentation, reports)
- **Features**: 
  - Editable in formatted view with toolbar
  - Supports **bold**, *italic*, and headers (H1-H3)
  - Automatically converts between markdown and HTML
  - Best for substantial written content
- **Use When**: Creating essays, articles, documentation, or any long-form text

### 2. **Code** (`kind: 'code'`)
- **Purpose**: Substantial code examples or complete implementations
- **Features**:
  - Syntax highlighting
  - Read-only view (no inline editing)
  - Copy and download functionality
- **Use When**: Sharing complete code files, complex examples, or substantial implementations
- **Don't Use For**: Small snippets (use inline markdown code blocks instead)

### 3. **HTML** (`kind: 'html'`)
- **Purpose**: Interactive HTML/CSS demonstrations
- **Features**:
  - Live preview in iframe
  - Interactive elements work
  - Can include inline CSS and JavaScript
- **Use When**: Creating interactive demos, forms, or UI examples

### 4. **React** (`kind: 'react'`)
- **Purpose**: React component demonstrations
- **Features**:
  - Syntax-highlighted TSX/JSX
  - Shows component structure
  - Preview shows code (not executed)
- **Use When**: Sharing React components or patterns

## Configuration

### Agent Builder

When creating or editing an agent in the Tool Builder:

1. **Enable Artifacts Toggle**
   - Label: "Enable Artifacts (Side Panel)"
   - Gives the agent access to the `createDocument` tool
   - When disabled, all code appears inline in the chat

2. **Artifact Instructions** (Optional)
   - Custom guidance for when and how to use artifacts
   - Leave empty for default behavior
   - Example instructions:
     ```
     Use createDocument tool for:
     • Rich text documents (essays, articles, documentation) - kind: 'document'
     • Interactive HTML/CSS demos - kind: 'html'  
     • React components - kind: 'react'
     • Substantial code that benefits from side panel - kind: 'code'

     For small code snippets, use regular markdown code blocks.
     ```

### Tool Configuration

The `createDocument` tool is automatically available when artifacts are enabled:

```typescript
createDocument({
  title: string,  // Descriptive title
  kind: 'document' | 'code' | 'html' | 'react'
})
```

**Tool Description:**
> Create an interactive artifact that streams to the side panel. Use ONLY for substantial content that benefits from side-by-side editing. For small code snippets, use inline markdown code blocks instead.

## Inline Code vs. Artifacts

### Use Inline Code Blocks For:
- ✅ Small code snippets (< 20 lines)
- ✅ Quick examples
- ✅ Single function demonstrations
- ✅ Terminal commands
- ✅ Configuration snippets

### Use Artifacts For:
- ✅ Complete files or implementations
- ✅ Essays, articles, or documentation
- ✅ Interactive HTML demos
- ✅ React components
- ✅ Code that users might want to edit or copy

## Editing Artifacts

### Document Artifacts
- Click "Edit" to enter edit mode
- Rich text toolbar appears with:
  - **Bold** button
  - *Italic* button
  - H1, H2, H3 header buttons
- Changes save automatically as markdown
- Preview updates in real-time

### Code/HTML/React Artifacts
- Click "Edit" to enter edit mode
- Shows raw text editor (markdown/code)
- No rich text formatting
- Save to update the artifact

## Technical Implementation

### Client-Side Type Mapping

```typescript
const kindMap: Record<string, Artifact['type']> = {
  'document': 'document',
  'text': 'document',     // Legacy support
  'code': 'code',
  'html': 'html',
  'react': 'react-component',
}
```

### Server-Side Schema

```typescript
const artifactSchema = z.object({
  title: z.string(),
  kind: z.enum(['document', 'text', 'code', 'html', 'react']),
  content: z.string(),
  language: z.string().optional(),
})
```

### Streaming Flow

1. AI calls `createDocument` tool with title and kind
2. Server streams artifact metadata to client (opens side panel)
3. Server uses `streamObject` to generate content
4. Content deltas stream to client in real-time
5. Client displays formatted content as it arrives
6. Artifact saves to database when complete

## Database Schema

Artifacts are stored in message `toolResults`:

```typescript
{
  toolCallId: string,      // Unique tool call ID (also artifact ID)
  result: {
    artifactId: string,
    title: string,
    kind: string,
    content: string,
    language?: string
  }
}
```

## Best Practices

### For AI Agents

1. **Use artifacts sparingly** - Only for substantial content
2. **Choose the right kind**:
   - `document` for text content users might edit
   - `code` for substantial code examples
   - `html` for interactive demos
   - `react` for component examples
3. **Use inline code blocks** for small snippets
4. **Provide clear titles** that describe the artifact

### For Users

1. **Enable artifacts** only for agents that need them
2. **Provide clear instructions** about when to use artifacts
3. **Test the behavior** to ensure it matches expectations
4. **Use document artifacts** for collaborative editing

## Examples

### Good Use Cases

```typescript
// ✅ Essay or article
createDocument({
  title: "Essay on Silicon Valley",
  kind: "document"
})

// ✅ Interactive demo
createDocument({
  title: "Interactive Form Example",
  kind: "html"
})

// ✅ Complete implementation
createDocument({
  title: "User Authentication Service",
  kind: "code"
})
```

### Bad Use Cases

```typescript
// ❌ Small snippet (use inline code block instead)
createDocument({
  title: "Array Sort Example",
  kind: "code"
})

// ❌ Simple command (use inline code block)
createDocument({
  title: "Install Command",
  kind: "code"
})
```

## Migration Notes

- Legacy `'text'` kind still works, maps to `'document'`
- Old artifacts without `kind` default to `'code'`
- Code blocks in messages remain inline unless `createDocument` is used
- Rich text editing only available for `document` artifacts

## Troubleshooting

### Artifacts not appearing
- Check if artifacts are enabled for the agent
- Verify the agent has artifact instructions
- Ensure the tool is calling `createDocument`

### Rich text editor not working
- Only available for `kind: 'document'`
- Other types show markdown/code editor
- Check browser console for errors

### Code appearing inline instead of side panel
- This is expected for small snippets
- Agent should use `createDocument` for substantial content
- Provide clear instructions to the agent

