# AI Streaming Implementation Analysis

**Date**: 2025-11-15
**Issue**: Garbled/incomplete text during AI streaming
**Severity**: High (Production Quality Issue)

---

## Executive Summary

Our AI streaming implementation suffers from **text corruption during display** - messages appear garbled during streaming but are saved correctly to the database. Analysis reveals this is caused by **improper React state updates** during stream consumption, not issues with the Vercel AI SDK itself.

**Root Cause**: We're updating message content via `setMessages` state updates inside a `TransformStream`, which triggers React re-renders during text-delta processing. This causes race conditions where partial text updates overwrite each other.

**Critical Finding**: The Vercel AI SDK's `consumeStream` is designed for **processing stream events**, not for managing React state. We're using it incorrectly.

---

## Current Architecture

### Backend (`src/server/routes/chat.ts`)

**Lines 485-844**: Chat POST endpoint using `createUIMessageStream` + `streamText`

```typescript
// ✅ CORRECT: Backend streaming implementation
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Stream AI response with tools
    const result = streamText({
      model: aiModel,
      messages,
      temperature: 0.7,
      maxTokens: 2048,
      tools,
      onFinish: async ({ text, finishReason, usage }) => {
        // Save to database after stream completes
        await db.insert(message).values({
          content: text,  // ✅ Complete text saved correctly
          toolCalls,
          toolResults,
        })
      },
    })

    // Merge AI stream into writer
    writer.merge(result.toUIMessageStream())
  },
})

// Return response
return createUIMessageStreamResponse({ stream })
```

**Assessment**: ✅ Backend implementation follows AI SDK best practices correctly.

### Frontend (`src/routes/_authenticated/ai-chat/index.tsx`)

**Lines 243-466**: Manual stream consumption with React state updates

```typescript
// ❌ PROBLEMATIC: Manual stream parsing with state updates
await consumeStream({
  stream: response.body!
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))
              controller.enqueue(data)
            }
          }
        },
      })
    )
    .pipeThrough(
      new TransformStream({
        async transform(part) {
          // ❌ CRITICAL ISSUE: State update inside transform stream
          if (streamPart.type === 'text-delta') {
            setMessages((prev) => {  // 🔴 Race condition risk
              const updated = prev.map((m) => {
                if (m.id === assistantMessageId) {
                  const newContent = m.content + deltaText
                  return {
                    ...m,
                    content: newContent,
                    parts: [{ type: 'text', text: newContent }],
                  }
                }
                return m
              })
              return updated
            })
          }
        },
      })
    ),
  onError: (streamError) => {
    console.error('❌ Stream error:', streamError)
    throw streamError
  },
})
```

**Assessment**: ❌ This is NOT how `consumeStream` should be used.

---

## Issues Identified

### 1. **Incorrect Use of `consumeStream` API**

**Problem**: We're manually parsing SSE format and calling `consumeStream` with custom `TransformStream` chains.

**What We're Doing**:
```typescript
consumeStream({
  stream: response.body!
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream({ /* SSE parsing */ }))
    .pipeThrough(new TransformStream({ /* State updates */ }))
})
```

**What AI SDK Expects**:
```typescript
// consumeStream is for processing ALREADY PARSED stream parts
// It should receive a stream of JSON objects, not raw SSE text
```

**Evidence from AI SDK Source**:
- `consumeStream` is a low-level utility for iterating over stream parts
- It expects **pre-parsed stream parts**, not raw HTTP response bodies
- We should use `useChat` hook or similar high-level APIs instead

### 2. **React State Updates Inside Transform Streams**

**Problem**: Line 345-359 updates React state (`setMessages`) inside `TransformStream.transform()`.

**Why This Causes Corruption**:
1. **Text deltas arrive faster than React can process**
   - Example: `"text" → "text with" → "text with work" → "text with workshops"`
   - If delta "with work" arrives before React finishes rendering "with", we get corruption

2. **Batching issues**:
   - React 18's automatic batching doesn't apply inside async transform streams
   - Each `setMessages` call triggers immediate re-render during streaming

3. **State update race conditions**:
   ```typescript
   // Delta 1: "Hello"
   setMessages(prev => [...prev, { content: "Hello" }])

   // Delta 2: " world" arrives BEFORE Delta 1 finishes
   setMessages(prev => [...prev, { content: "Hello world" }])  // prev is stale!
   ```

### 3. **Mixing UI State with Stream Processing**

**Problem**: We're trying to do two things at once:
1. Parse and consume the stream (data processing)
2. Update React UI state (view layer)

**These should be separated**:
- ✅ Vercel AI SDK handles stream parsing
- ✅ React hooks handle UI state updates
- ❌ We shouldn't do BOTH manually

### 4. **Custom Artifact Streaming Interference**

**Lines 362-436**: Custom artifact handling via `data-artifact-*` parts

```typescript
if (streamPart.type === 'data-artifact-metadata') {
  setArtifacts((prev) => [...prev, newArtifact])
  setIsPanelOpen(true)  // Another state update!
}

if (streamPart.type === 'data-artifact-delta') {
  setArtifacts((prev) =>  // Yet another state update!
    prev.map((artifact) =>
      artifact.id === id
        ? { ...artifact, content: data }
        : artifact
    )
  )
}
```

**Impact**:
- Multiple concurrent state updates (`setMessages`, `setArtifacts`, `setIsPanelOpen`)
- All triggering during the same stream processing loop
- Compounds the race condition problem

### 5. **Missing Error Boundaries for Stream Corruption**

**Problem**: No validation that text deltas are strings before concatenation.

**Line 339-342**:
```typescript
if (typeof deltaText !== 'string') {
  console.warn('⚠️ Invalid text-delta:', streamPart)
  return  // ✅ Good safety check
}
```

**But**: This only logs a warning. Corrupted deltas still break the message content.

---

## Root Cause Analysis

### Why Text Gets Garbled During Streaming

**Scenario**: User sends message "I need help with workshops..."

1. **Backend sends SSE stream**:
   ```
   data: {"type":"text-delta","delta":"I need"}
   data: {"type":"text-delta","delta":" help"}
   data: {"type":"text-delta","delta":" with"}
   data: {"type":"text-delta","delta":" workshops"}
   ```

2. **Frontend processes deltas**:
   ```typescript
   // Delta 1: "I need"
   setMessages(prev => prev.map(m => m.id === id ? {...m, content: "I need"} : m))
   // React schedules render #1

   // Delta 2: " help" (arrives before render #1 completes)
   setMessages(prev => prev.map(m => m.id === id ? {...m, content: "I need help"} : m))
   // React schedules render #2

   // Delta 3: " with" (arrives before render #2 completes)
   setMessages(prev => prev.map(m => m.id === id ? {...m, content: "I need help with"} : m))
   // React schedules render #3
   ```

3. **Race condition occurs**:
   - Render #2 might start BEFORE Render #1 finishes
   - React's reconciliation algorithm gets confused
   - Text content becomes: `"I need help with? Looking attract new, or something else?"`
   - Missing words: "workshops", "the main goal for"

4. **Database saves correctly**:
   - Backend's `onFinish` callback receives **complete text** from AI SDK
   - No state management involved
   - Database gets: `"I need help with workshops\n\nAlright, what's the main goal for your workshop?"`

**Conclusion**: The corruption happens **only in the React UI layer**, not in the stream itself.

---

## Comparison with AI SDK Best Practices

### What We're Doing vs. What We Should Do

| Aspect | Our Implementation | AI SDK Best Practice |
|--------|-------------------|---------------------|
| **Stream Consumption** | Manual SSE parsing + `consumeStream` | Use `useChat` hook or `TextStreamChatTransport` |
| **State Updates** | Direct `setMessages` in transform stream | Let hook manage state automatically |
| **Text Deltas** | Concatenate in `setMessages` callback | Hook accumulates deltas internally |
| **Custom Data** | Manual `data-artifact-*` parsing | Define custom `UIMessage` type + `onData` callback |
| **Error Handling** | `onError` in `consumeStream` | `onError` in `useChat` hook |
| **Message Format** | Mix of `content` string and `parts` array | Consistent use of `parts` array |

### Recommended Pattern from AI SDK Docs

**Server** (we're doing this correctly):
```typescript
const stream = createUIMessageStream({
  execute: ({ writer }) => {
    const result = streamText({ model, messages })
    writer.merge(result.toUIMessageStream())
  },
})
return createUIMessageStreamResponse({ stream })
```

**Client** (we should do this):
```typescript
import { useChat } from '@ai-sdk/react'
import { DataStreamChatTransport } from 'ai'

const { messages, sendMessage } = useChat({
  transport: new DataStreamChatTransport({ api: '/api/chat' }),
  onData: (dataPart) => {
    // Handle custom data parts
    if (dataPart.type === 'data-artifact-metadata') {
      setArtifacts(prev => [...prev, dataPart.data])
    }
  },
})

// Messages automatically updated by hook
return messages.map(m => <Message content={m.content} />)
```

**Key Difference**: The `useChat` hook **manages message state internally** and exposes it as a prop, avoiding all race conditions.

---

## Impact of Custom Artifacts

### How Artifact Streaming Interferes with Normal Text

**Current Flow**:
1. AI calls `createDocument` tool
2. Backend sends `data-artifact-metadata` (opens panel)
3. Backend streams artifact content via `data-artifact-delta`
4. Backend ALSO streams normal text response via `text-delta`

**Problem**: Both artifact deltas AND text deltas trigger state updates simultaneously:

```typescript
// Text delta
if (streamPart.type === 'text-delta') {
  setMessages(prev => /* update message */)  // State update #1
}

// Artifact delta (happens at same time)
if (streamPart.type === 'data-artifact-delta') {
  setArtifacts(prev => /* update artifact */)  // State update #2
}
```

**Result**:
- React tries to batch these updates
- But they're happening inside async transform streams
- Batching fails
- UI flickers and text gets corrupted

### Additional Complexity from Artifacts

**Lines 362-436** handle 3 different artifact stream parts:
1. `data-artifact-metadata` → Opens panel, adds artifact to array
2. `data-artifact-delta` → Updates artifact content (many times per second)
3. `data-artifact-complete` → Finalizes artifact

Each triggers state updates to `artifacts` array, compounding the message state update problem.

---

## Recommendations

### Critical Fixes

#### 1. **Replace Manual Stream Consumption with `useChat` Hook**

**Current** (Lines 243-466):
```typescript
await consumeStream({
  stream: response.body!.pipeThrough(/* manual parsing */)
})
```

**Recommended**:
```typescript
import { useChat } from '@ai-sdk/react'
import { DataStreamChatTransport } from 'ai'

const { messages, append, isLoading } = useChat({
  transport: new DataStreamChatTransport({
    api: '/api/v1/chat',
    body: {
      conversationId: effectiveConversationId,
      model: selectedModel,
      agentId,
    },
  }),

  // Handle custom artifact data parts
  onData: (dataPart) => {
    if (dataPart.type === 'data-artifact-metadata') {
      const { id, data } = dataPart
      setArtifacts(prev => [...prev, {
        id,
        title: data.title,
        type: data.kind,
        content: '',
      }])
      setIsPanelOpen(true)
    }

    if (dataPart.type === 'data-artifact-delta') {
      const { id, data } = dataPart
      setArtifacts(prev =>
        prev.map(a => a.id === id ? { ...a, content: data } : a)
      )
    }
  },

  // Error handling
  onError: (error) => {
    console.error('Chat error:', error)
    setError(error)
  },
})
```

**Benefits**:
- ✅ No manual SSE parsing
- ✅ No manual state management for messages
- ✅ Text deltas handled internally by hook
- ✅ Automatic batching and optimization
- ✅ Built-in error recovery

#### 2. **Define Custom UIMessage Type for Artifacts**

**File**: `src/types/ui-messages.ts`

```typescript
import { UIMessage } from 'ai'

export type CustomUIMessage = UIMessage<
  never,  // No custom message types
  {
    // Artifact metadata (transient)
    'artifact-metadata': {
      data: {
        id: string
        title: string
        kind: 'document' | 'code' | 'html' | 'react'
      }
    }

    // Artifact content (persistent)
    'artifact-delta': {
      data: string
    }

    // Artifact completion
    'artifact-complete': {
      data: {
        title: string
        kind: string
        content: string
        language?: string
      }
    }
  }
>
```

**Usage**:
```typescript
const { messages } = useChat<CustomUIMessage>({
  transport: new DataStreamChatTransport({ api: '/api/chat' }),
  onData: (dataPart) => {
    // TypeScript now knows all custom data part types
  },
})
```

#### 3. **Separate Artifact State from Message State**

**Problem**: We're managing artifacts separately but updating them during message stream processing.

**Solution**: Use separate hook for artifact state management:

```typescript
// hooks/use-artifacts-stream.ts
export function useArtifactsStream(conversationId: string) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`artifacts-${conversationId}`)
    if (stored) setArtifacts(JSON.parse(stored))
  }, [conversationId])

  // Persist to localStorage
  useEffect(() => {
    if (artifacts.length > 0) {
      localStorage.setItem(`artifacts-${conversationId}`, JSON.stringify(artifacts))
    }
  }, [artifacts, conversationId])

  const handleArtifactData = useCallback((dataPart: any) => {
    if (dataPart.type === 'data-artifact-metadata') {
      // Add new artifact and open panel
      setArtifacts(prev => [...prev, { ...dataPart.data, content: '' }])
      setCurrentIndex(artifacts.length)
      setIsPanelOpen(true)
    }

    if (dataPart.type === 'data-artifact-delta') {
      // Update artifact content
      setArtifacts(prev =>
        prev.map(a => a.id === dataPart.id ? { ...a, content: dataPart.data } : a)
      )
    }
  }, [artifacts.length])

  return {
    artifacts,
    currentIndex,
    isPanelOpen,
    setCurrentIndex,
    setIsPanelOpen,
    handleArtifactData,
  }
}
```

**Usage in Chat Component**:
```typescript
const { messages, append } = useChat({
  onData: artifactHandlers.handleArtifactData,
})

const artifactHandlers = useArtifactsStream(conversationId)
```

#### 4. **Fix Backend Stream Part Types**

**Current** (Lines 518-522):
```typescript
writer.write({
  type: 'data-artifact-metadata',
  id: artifactId,
  data: { id: artifactId, title, kind },
})
```

**Issue**: Type should match our custom UIMessage definition.

**Fix**:
```typescript
writer.write({
  type: 'data-artifact-metadata',  // ✅ Matches custom type
  data: { id: artifactId, title, kind },
})
```

---

### Improvements

#### 5. **Add Optimistic Updates for Better UX**

```typescript
const { messages, append } = useChat({
  experimental_prepareRequestBody: ({ messages }) => ({
    messages,
    conversationId: effectiveConversationId,
    model: selectedModel,
  }),
})

// Optimistic update
await append({
  text: userInput,
  optimistic: true,  // Shows immediately in UI
})
```

#### 6. **Implement Progressive Rendering Indicators**

```typescript
const { isLoading, isStreaming } = useChat()

// Show thinking indicator during initial processing
{isLoading && !isStreaming && <ThinkingIndicator />}

// Show typing indicator during streaming
{isStreaming && <TypingIndicator />}
```

#### 7. **Add Stream Retry Logic**

```typescript
const { messages, error, reload } = useChat({
  onError: (error) => {
    console.error('Stream error:', error)
    // Auto-retry on network errors
    if (error.message.includes('network')) {
      setTimeout(() => reload(), 2000)
    }
  },
})
```

#### 8. **Debounce Artifact State Updates**

**Problem**: Artifact deltas arrive too fast (100+ updates/second).

**Solution**:
```typescript
import { useDebounce } from '@/hooks/use-debounce'

const handleArtifactDelta = useMemo(
  () => debounce((id: string, content: string) => {
    setArtifacts(prev =>
      prev.map(a => a.id === id ? { ...a, content } : a)
    )
  }, 50),  // Update at most 20 times per second
  []
)
```

---

## Code Examples

### Complete Refactored Chat Component

```typescript
'use client'

import { useChat } from '@ai-sdk/react'
import { DataStreamChatTransport } from 'ai'
import { useState, useCallback } from 'react'
import { useArtifactsStream } from '@/hooks/use-artifacts-stream'
import type { CustomUIMessage } from '@/types/ui-messages'

export default function ChatPage() {
  const { conversationId, agentId } = Route.useSearch()
  const [selectedModel, setSelectedModel] = useState('gpt-4o')

  // Artifact state management (separate from messages)
  const artifactHandlers = useArtifactsStream(conversationId)

  // Chat state management (messages handled by hook)
  const {
    messages,
    append,
    isLoading,
    error,
    reload,
  } = useChat<CustomUIMessage>({
    transport: new DataStreamChatTransport({
      api: '/api/v1/chat',
    }),

    // Build request body
    experimental_prepareRequestBody: ({ messages }) => ({
      conversationId,
      model: selectedModel,
      agentId,
      messages,
    }),

    // Handle custom artifact data parts
    onData: artifactHandlers.handleArtifactData,

    // Error handling
    onError: (error) => {
      console.error('Chat error:', error)
      // Auto-retry on network errors
      if (error.message.includes('Failed to fetch')) {
        setTimeout(() => reload(), 2000)
      }
    },

    // Success callback
    onFinish: ({ message }) => {
      console.log('Message complete:', message.content)
      // Refresh conversation list
      invalidateConversations()
    },
  })

  // Send message handler
  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return

    append({
      text,
      // Optimistic update
      optimistic: {
        id: nanoid(),
        role: 'user',
        content: text,
      },
    })
  }, [append])

  return (
    <div className="flex h-full">
      {/* Chat Area */}
      <div className="flex-1">
        <Conversation>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {/* Render message parts (text, tool results, etc.) */}
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return <MessageResponse key={i}>{part.text}</MessageResponse>
                  }
                  if (part.type === 'tool-result') {
                    return <ToolResult key={i}>{part.result}</ToolResult>
                  }
                  return null
                })}
              </MessageContent>
            </Message>
          ))}

          {/* Loading indicator */}
          {isLoading && <ThinkingIndicator />}

          {/* Error display */}
          {error && (
            <ErrorMessage>
              {error.message}
              <Button onClick={reload}>Retry</Button>
            </ErrorMessage>
          )}
        </Conversation>

        {/* Input */}
        <PromptInput onSubmit={(msg) => handleSend(msg.text)}>
          <PromptInputTextarea disabled={isLoading} />
          <PromptInputSubmit />
        </PromptInput>
      </div>

      {/* Artifact Panel */}
      {artifactHandlers.isPanelOpen && (
        <ArtifactSidePanel
          artifacts={artifactHandlers.artifacts}
          currentIndex={artifactHandlers.currentIndex}
          onClose={() => artifactHandlers.setIsPanelOpen(false)}
        />
      )}
    </div>
  )
}
```

### Updated Backend (Minimal Changes Needed)

**File**: `src/server/routes/chat.ts`

**Only change needed**: Ensure data part types match frontend custom types

```typescript
// Line 518 - Already correct
writer.write({
  type: 'data-artifact-metadata',  // ✅ Matches CustomUIMessage type
  data: { id: artifactId, title, kind },
})

// Line 541 - Already correct
writer.write({
  type: 'data-artifact-delta',  // ✅ Matches CustomUIMessage type
  data: delta.object.content,
})

// Line 553 - Already correct
writer.write({
  type: 'data-artifact-complete',  // ✅ Matches CustomUIMessage type
  data: finalArtifact,
})
```

---

## Testing Strategy

### 1. **Unit Tests for Stream Processing**

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useChat } from '@ai-sdk/react'

describe('Chat streaming', () => {
  it('should accumulate text deltas correctly', async () => {
    const { result } = renderHook(() =>
      useChat({ api: '/api/chat' })
    )

    // Simulate sending message
    result.current.append({ text: 'Hello' })

    // Wait for streaming to complete
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    // Check final message content
    const assistantMessage = result.current.messages[1]
    expect(assistantMessage.content).toBe('Complete response text')
    expect(assistantMessage.content).not.toContain('undefined')
  })

  it('should handle rapid deltas without corruption', async () => {
    // Send 100 rapid text deltas
    const deltas = Array(100).fill(0).map((_, i) => `word${i} `)

    // Verify final text is complete
    const expected = deltas.join('')
    expect(finalMessage.content).toBe(expected)
  })
})
```

### 2. **Integration Tests with Mock Stream**

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.post('/api/v1/chat', () => {
    // Return SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"text-delta","delta":"Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"text-delta","delta":" world"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"finish"}\n\n'))
        controller.close()
      },
    })

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    })
  })
)

test('should consume SSE stream correctly', async () => {
  const { result } = renderHook(() => useChat({ api: '/api/v1/chat' }))

  await result.current.append({ text: 'Test' })

  await waitFor(() => {
    expect(result.current.messages[1].content).toBe('Hello world')
  })
})
```

### 3. **E2E Tests with Real Models**

```typescript
import { test, expect } from '@playwright/test'

test('should stream without text corruption', async ({ page }) => {
  await page.goto('/ai-chat')

  // Send message
  await page.fill('[data-testid="message-input"]', 'Write a short essay')
  await page.click('[data-testid="send-button"]')

  // Wait for streaming to start
  await page.waitForSelector('[data-testid="thinking-indicator"]')

  // Wait for streaming to complete
  await page.waitForSelector('[data-testid="message-complete"]')

  // Get final message content
  const messageText = await page.textContent('[data-testid="assistant-message"]')

  // Verify no corruption patterns
  expect(messageText).not.toContain('undefined')
  expect(messageText).not.toMatch(/\?\s+Looking/)  // Pattern from bug report
  expect(messageText).not.toMatch(/,\s+or something/)
})

test('should handle artifacts without affecting text', async ({ page }) => {
  await page.goto('/ai-chat?agentId=artifact-agent')

  // Trigger artifact creation
  await page.fill('[data-testid="message-input"]', 'Create a document')
  await page.click('[data-testid="send-button"]')

  // Verify artifact panel opens
  await page.waitForSelector('[data-testid="artifact-panel"]')

  // Verify chat message is clean
  const chatMessage = await page.textContent('[data-testid="assistant-message"]')
  expect(chatMessage).toContain('Created artifact:')
  expect(chatMessage).not.toContain('undefined')
})
```

### 4. **Performance Tests**

```typescript
test('should handle 1000 rapid deltas', async () => {
  const startTime = Date.now()

  // Simulate 1000 text deltas
  for (let i = 0; i < 1000; i++) {
    handleTextDelta(`word${i} `)
  }

  const endTime = Date.now()
  const duration = endTime - startTime

  // Should complete in < 1 second
  expect(duration).toBeLessThan(1000)

  // Should have correct final text
  expect(finalText).toHaveLength(1000 * 6)  // "word0 " = 6 chars
})
```

### 5. **Cross-Model Testing**

Test with all supported models to ensure consistency:

```typescript
const models = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet-20241022',
  'grok-2-latest',
]

for (const model of models) {
  test(`should stream correctly with ${model}`, async ({ page }) => {
    await page.goto(`/ai-chat?model=${model}`)
    await page.fill('[data-testid="message-input"]', 'Hello')
    await page.click('[data-testid="send-button"]')

    await page.waitForSelector('[data-testid="message-complete"]')

    const messageText = await page.textContent('[data-testid="assistant-message"]')
    expect(messageText).toBeTruthy()
    expect(messageText).not.toContain('undefined')
  })
}
```

---

## Migration Plan

### Phase 1: Refactor Chat Component (Week 1)

**Day 1-2**: Replace manual stream consumption
- Install latest `@ai-sdk/react` package
- Replace `consumeStream` with `useChat` hook
- Remove manual SSE parsing code
- Test with existing backend (should work without changes)

**Day 3**: Define custom UIMessage types
- Create `src/types/ui-messages.ts`
- Define artifact data part types
- Update TypeScript types throughout

**Day 4-5**: Extract artifact state management
- Create `useArtifactsStream` hook
- Move artifact logic out of chat component
- Connect `onData` callback

### Phase 2: Testing & Validation (Week 2)

**Day 1-2**: Unit tests
- Test message accumulation
- Test rapid deltas
- Test artifact state updates

**Day 3**: Integration tests
- Mock stream responses
- Test error handling
- Test retry logic

**Day 4-5**: E2E tests
- Test with real models
- Test all artifact types
- Cross-browser testing

### Phase 3: Performance Optimization (Week 3)

**Day 1**: Debounce artifact updates
**Day 2**: Implement optimistic updates
**Day 3**: Add progressive rendering indicators
**Day 4-5**: Load testing and profiling

### Phase 4: Rollout (Week 4)

**Day 1**: Deploy to staging
**Day 2-3**: QA testing
**Day 4**: Gradual rollout (10% → 50% → 100%)
**Day 5**: Monitor and iterate

---

## Appendix: Key AI SDK Concepts

### Data Stream Protocol

The Vercel AI SDK uses a custom **Data Stream Protocol** for sending structured data:

**Format**: Server-Sent Events (SSE) with JSON payloads
```
data: {"type":"text-delta","delta":"Hello"}
data: {"type":"text-delta","delta":" world"}
data: {"type":"finish","finishReason":"stop"}
```

**Stream Part Types**:
- `text-start` - Begin new text block
- `text-delta` - Incremental text chunk
- `text-end` - Complete text block
- `tool-call` - AI requests tool execution
- `tool-result` - Tool execution result
- `data-*` - Custom application data
- `finish` - Stream complete

### UIMessage Type

UI messages have a **parts-based structure**:

```typescript
interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'tool-call'; toolName: string; args: unknown }
    | { type: 'tool-result'; result: unknown }
  >
}
```

**NOT**:
```typescript
// ❌ Don't use content string directly
interface Message {
  content: string
}
```

### TransformStream vs. useChat

**TransformStream**: Low-level browser API for stream processing
- Good for: Data transformation, parsing, buffering
- Bad for: UI state management, React integration

**useChat Hook**: High-level React hook for chat UIs
- Good for: Message state, streaming, error handling
- Bad for: Custom stream protocols (use DataStreamChatTransport instead)

---

## References

### Vercel AI SDK Documentation
- [Data Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [useChat Hook](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [createUIMessageStream](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream)

### Research Documents
- `/RESEARCH-vercel-artifact-streaming.md` - Our analysis of Vercel's artifact patterns
- `/ARTIFACT_SYSTEM_GUIDE.md` - Our artifact implementation guide

### Code Files Analyzed
- `src/routes/_authenticated/ai-chat/index.tsx` (Lines 1-682)
- `src/server/routes/chat.ts` (Lines 1-1340)

---

**Generated**: 2025-11-15
**Author**: Claude Code Analysis
**Next Steps**: Review recommendations and begin Phase 1 refactoring
