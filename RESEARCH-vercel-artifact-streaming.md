# Vercel AI Chatbot Artifact Streaming Implementation

Research findings on how the Vercel AI Chatbot (Chat SDK) handles artifact streaming, detection, and rendering.

---

## Overview

The Vercel AI Chatbot uses a **tool-based architecture** where artifacts are created through tool calls (like `createDocument`), not through markdown code block parsing. The key insight is that **artifacts are detected during streaming through custom data stream parts**, not by monitoring the text content.

---

## 1. How They Detect Artifact Creation During Streaming

### Tool-Based Detection (Not Code Block Parsing)

Artifacts are created when the AI model calls the `createDocument` tool. The detection happens through **custom data stream parts** sent via `dataStream.write()`.

**Server-Side Tool Implementation** (`lib/ai/tools/create-document.ts`):

```typescript
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: "Create a document for writing or content creation...",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds), // "text", "code", "sheet", "image"
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      // 1. Signal artifact metadata to client (TRANSIENT - not in message history)
      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      // 2. Clear previous artifact state
      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      // 3. Delegate to specialized handler (text, code, sheet, etc.)
      const documentHandler = documentHandlersByArtifactKind.find(
        (handler) => handler.kind === kind
      );

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
      });

      // 4. Signal completion
      dataStream.write({
        type: "data-finish",
        data: null,
        transient: true
      });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
```

**Key Points**:
- Artifacts are NOT detected by parsing markdown code blocks
- Instead, the AI model explicitly calls `createDocument` tool
- Tool sends **transient data parts** (`data-kind`, `data-id`, `data-title`, `data-clear`)
- These transient parts trigger artifact creation on the client via `onData` callback

---

## 2. How They Stream Artifact Content

### Server-Side Content Streaming

After signaling metadata, the **document handler** streams the actual content.

**Code Artifact Handler** (`artifacts/code/server.ts`):

```typescript
export const codeDocumentHandler = createDocumentHandler<z.infer<typeof schema>>({
  kind: "code",
  schema,

  onCreateDocument: async ({ title, dataStream, session }) => {
    const { object, fullStream } = streamObject({
      model: getModel(session),
      system: createDocumentPrompt(title, "code"),
      schema,
      output: "object",
    });

    // Stream code content as it generates
    for await (const delta of fullStream) {
      if (delta.type === "object") {
        const code = delta.object.code;
        if (code) {
          // Send code deltas to client
          dataStream.write({
            type: "data-codeDelta",  // Custom stream part type
            data: code,
            transient: false,  // This one DOES persist in message
          });
        }
      }
    }

    const content = await object;
    return JSON.stringify(content);
  },

  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    // Similar streaming pattern for updates
    // ...
  },
});
```

**Key Points**:
- Uses `streamObject` from Vercel AI SDK to generate structured content
- Streams content via custom data parts (`data-codeDelta`)
- Content deltas are sent with `transient: false` so they persist in message history
- Client receives these via `onStreamPart` handler

---

## 3. How They Prevent Code Blocks from Showing in Chat

### Separation of Concerns

The tool return value is what appears in the chat, NOT the streamed content.

**Tool Return Value** (what shows in chat):
```typescript
return {
  id,
  title,
  kind,
  content: "A document was created and is now visible to the user.",
};
```

**Streamed Content** (what shows in artifact panel):
- Sent via `dataStream.write()` with custom types (`data-codeDelta`)
- Received by artifact component via `onStreamPart` handler
- Never rendered in message component

**Message Rendering** (`components/message.tsx`):
```typescript
export const PurePreviewMessage = ({ message, /* ... */ }) => {
  return message.parts.map((part) => {
    const { type } = part;

    if (type === "text") {
      return (
        <MessageContent>
          <Response>{sanitizeText(part.text)}</Response>
        </MessageContent>
      );
    }

    if (type === "tool-createDocument") {
      // Renders the tool RESULT: "A document was created..."
      // NOT the actual code content
      return <ToolResult>{part.result.content}</ToolResult>;
    }

    // Other tool types...
  });
};
```

**Key Points**:
- Tool results appear in chat messages (e.g., "A document was created...")
- Artifact content streams to a separate component
- Custom data stream parts (`data-codeDelta`) are NOT rendered in message component
- This maintains clean separation between chat and artifact panel

---

## 4. How They Auto-Open the Artifact Panel

### Client-Side Detection via `onData` Callback

The chat component listens for transient data parts to trigger artifact visibility.

**Chat Component** (`components/chat.tsx`):

```typescript
const { messages } = useChat<MyUIMessage>({
  api: '/api/chat',

  // Handle transient data parts (NOT in message history)
  onData: (dataPart) => {
    if (dataPart.type === 'data-kind') {
      // Artifact creation started!
      setArtifact({
        kind: dataPart.data,
        isVisible: true,  // AUTO-OPEN PANEL
        status: 'streaming',
      });
    }

    if (dataPart.type === 'data-id') {
      setArtifact((prev) => ({
        ...prev,
        id: dataPart.data,
      }));
    }

    if (dataPart.type === 'data-title') {
      setArtifact((prev) => ({
        ...prev,
        title: dataPart.data,
      }));
    }

    if (dataPart.type === 'data-clear') {
      // Clear previous artifact
      setArtifact(null);
    }
  },
});

const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
```

**Artifact Component** (`components/artifact.tsx`):

```typescript
export const Artifact = ({ messages, /* ... */ }) => {
  const artifact = useArtifact(); // Zustand store

  return (
    <>
      {artifact.isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="artifact-panel"
        >
          {/* Render artifact content */}
        </motion.div>
      )}
    </>
  );
};
```

**Key Points**:
- `onData` callback receives transient data parts BEFORE they're added to message history
- `data-kind` signal triggers `isVisible: true` (auto-open)
- Artifact state managed via Zustand store (`useArtifact`)
- Panel opens immediately when tool execution begins, not after completion

---

## 5. Patterns for Monitoring Streaming State

### Client-Side Artifact Handler

Each artifact type has an `onStreamPart` handler to process streaming content.

**Code Artifact Client** (`artifacts/code/client.tsx`):

```typescript
export default {
  kind: "code",

  // Called when artifact is first created
  initialize: ({ setMetadata }) => {
    setMetadata({ language: "javascript" });
  },

  // Handle streaming content updates
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-codeDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,  // Update content in real-time
        status: "streaming",
      }));
    }
  },

  // Render the artifact UI
  content: ({ artifact, metadata }) => {
    return (
      <div>
        <CodeEditor
          code={artifact.content}
          language={metadata.language}
        />
        <Console output={executionOutput} />
      </div>
    );
  },

  // Toolbar actions
  toolbar: ({ artifact, sendMessage }) => {
    return (
      <Button onClick={() => sendMessage("Add comments to the code")}>
        Add Comments
      </Button>
    );
  },
};
```

**Key Points**:
- `onStreamPart` processes streaming deltas in real-time
- Updates artifact content incrementally (not all at once)
- Status tracked: `"streaming"` → `"idle"`
- Content visible during streaming (progressive rendering)

---

## 6. Key Architecture Patterns

### Data Stream Types

**Vercel AI SDK Custom Data Parts**:

```typescript
// Define custom message types
export type MyUIMessage = UIMessage<
  never,
  {
    // Artifact metadata (transient)
    kind: {
      data: "text" | "code" | "sheet" | "image";
    };
    id: {
      data: string;
    };
    title: {
      data: string;
    };
    clear: {
      data: null;
    };
    finish: {
      data: null;
    };

    // Artifact content (persistent)
    codeDelta: {
      data: string;
    };
  }
>;
```

**Server-Side Stream Creation**:

```typescript
const stream = createUIMessageStream<MyUIMessage>({
  execute: ({ writer }) => {
    // Send transient metadata
    writer.write({
      type: 'data-kind',
      data: 'code',
      transient: true,  // Not in message history
    });

    // Stream tool execution
    const result = streamText({
      model,
      messages,
      tools: { createDocument, updateDocument },
    });

    // Merge AI response with custom data
    writer.merge(result.toUIMessageStream());
  },
});

return createUIMessageStreamResponse({ stream });
```

**Client-Side Reception**:

```typescript
const { messages } = useChat<MyUIMessage>({
  api: '/api/chat',

  // Handle transient parts (metadata signals)
  onData: (dataPart) => {
    if (dataPart.type === 'data-kind') {
      // Auto-open artifact panel
      setArtifact({ kind: dataPart.data, isVisible: true });
    }
  },
});

// Artifact component receives persistent parts
artifact.onStreamPart({ streamPart: { type: 'data-codeDelta', data: '...' } });
```

---

## 7. Implementation Checklist

To implement Vercel-style artifact streaming in your app:

### Server-Side

- [ ] Create `createDocument` tool with `dataStream.write()` calls
- [ ] Send transient metadata parts: `data-kind`, `data-id`, `data-title`, `data-clear`
- [ ] Create document handlers per artifact type (code, text, etc.)
- [ ] Use `streamObject` or `streamText` to generate content
- [ ] Send content via custom data parts (`data-codeDelta`, `data-textDelta`)
- [ ] Send `data-finish` when complete
- [ ] Tool return value should be user-friendly message (not code content)

### Client-Side

- [ ] Define custom `UIMessage` types for your data parts
- [ ] Use `useChat` with `onData` callback to detect artifact creation
- [ ] Set `isVisible: true` when receiving `data-kind` signal
- [ ] Create artifact components with `onStreamPart` handlers
- [ ] Update artifact content incrementally during streaming
- [ ] Render artifacts in separate panel (not in message list)
- [ ] Track artifact state with Zustand or similar

### Architecture

- [ ] Separate chat messages from artifact content
- [ ] Use transient parts for UI signals (not in history)
- [ ] Use persistent parts for content (appears in history)
- [ ] Tool results in chat should be summaries, not full content
- [ ] Artifact panel auto-opens on first data part
- [ ] Progressive rendering as content streams

---

## 8. Key Differences from Code Block Parsing

| Aspect | Code Block Parsing | Vercel Artifact Approach |
|--------|-------------------|-------------------------|
| **Detection** | Regex/markdown parsing | Tool calls + data stream parts |
| **Streaming** | Wait for complete block | Progressive rendering during stream |
| **Separation** | Parse content to extract | Separate channels from the start |
| **Auto-open** | After block completes | Immediately on tool execution |
| **History** | Code appears in messages | Summary appears in messages |
| **Complexity** | High (parsing, state sync) | Low (built-in SDK features) |

---

## 9. Code Examples from Vercel AI Chatbot

### Complete Flow Example

**1. User Message**: "Create a React component for a todo list"

**2. AI Model Response**: Calls `createDocument` tool
```json
{
  "tool": "createDocument",
  "arguments": {
    "title": "TodoList Component",
    "kind": "code"
  }
}
```

**3. Server Sends Metadata** (transient):
```typescript
dataStream.write({ type: "data-kind", data: "code", transient: true });
dataStream.write({ type: "data-id", data: "abc-123", transient: true });
dataStream.write({ type: "data-title", data: "TodoList Component", transient: true });
dataStream.write({ type: "data-clear", data: null, transient: true });
```

**4. Client Receives Metadata** (`onData` callback):
```typescript
onData: (dataPart) => {
  if (dataPart.type === 'data-kind') {
    setArtifact({
      kind: 'code',
      isVisible: true,  // PANEL AUTO-OPENS
      status: 'streaming',
    });
  }
}
```

**5. Server Streams Content**:
```typescript
for await (const delta of fullStream) {
  if (delta.type === "object") {
    dataStream.write({
      type: "data-codeDelta",
      data: delta.object.code,  // Progressive code chunks
      transient: false,
    });
  }
}
```

**6. Client Updates Artifact** (`onStreamPart`):
```typescript
onStreamPart: ({ streamPart, setArtifact }) => {
  if (streamPart.type === "data-codeDelta") {
    setArtifact((prev) => ({
      ...prev,
      content: streamPart.data,  // Update in real-time
    }));
  }
}
```

**7. Server Sends Completion**:
```typescript
dataStream.write({ type: "data-finish", data: null, transient: true });
```

**8. Tool Returns Summary** (appears in chat):
```typescript
return {
  content: "A document was created and is now visible to the user."
};
```

**9. User Sees**:
- Chat message: "A document was created and is now visible to the user."
- Artifact panel: React component code (rendered in CodeEditor)

---

## 10. Resources

- **Vercel AI Chatbot Repo**: https://github.com/vercel/ai-chatbot
- **Chat SDK Docs**: https://chat-sdk.dev/docs/customization/artifacts
- **AI SDK Streaming Data**: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
- **AI SDK streamText**: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

---

## Conclusion

The Vercel AI Chatbot approach to artifact streaming is elegant because:

1. **Tool-based detection** - No regex parsing, just structured tool calls
2. **Transient data parts** - Metadata signals don't pollute message history
3. **Progressive rendering** - Artifacts update in real-time during streaming
4. **Clean separation** - Chat messages and artifacts use different channels
5. **Built-in SDK support** - Leverages Vercel AI SDK's `dataStream.write()` API

The key insight is **using custom data stream parts** instead of parsing markdown. This approach is more reliable, easier to maintain, and provides better UX (auto-open, progressive rendering).
