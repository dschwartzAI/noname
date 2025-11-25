# How to Port the Beautiful Artifact Pattern to Your Noname App

## What You Want

The **smooth, intelligent artifact creation** from this Next.js app where:
1. ✨ AI **automatically knows** when to create a document
2. 📝 A document **starts streaming immediately** in a side panel
3. 🎨 The panel **beautifully expands** while content streams in word-by-word
4. ✏️ When done, it's **instantly editable**
5. 🔄 You can **open/close** the panel smoothly
6. 🎯 It **feels fast and polished**

---

## The Secret Sauce: Tool-Based Artifacts

### How This Next.js App Does It

The magic is in **two AI tools** that work together:

1. **`createDocument`** - AI calls this to START a new artifact
2. **`updateDocument`** - AI calls this to EDIT existing artifacts

The AI **intelligently decides** when to use these tools based on the conversation.

---

## Step 1: Understanding the Pattern (10 min)

### A. The Tool Definition

**File**: `lib/ai/tools/create-document.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export function createDocument({ session, dataStream }) {
  return tool({
    description: `Create a document for a writing activity. This tool will call other functions that will generate the contents of the document based on the title. It does not have the capability to save the document, so the user must do so manually.`,
    
    parameters: z.object({
      title: z.string().describe('The title of the document'),
    }),
    
    execute: async ({ title }) => {
      // 1. Create document in DB
      const id = generateUUID();
      
      // 2. Send to frontend IMMEDIATELY (starts panel opening)
      dataStream.write({
        type: 'data-document-created',
        data: { id, title },
      });

      // 3. Start streaming content
      const handler = getDocumentHandler('text'); // or 'code', 'spreadsheet'
      
      const content = await handler.onCreateDocument({
        title,
        dataStream, // Streams deltas to frontend
      });

      // 4. Save final document
      await saveDocument({ id, title, content, kind: 'text' });

      return `Created document: ${title}`;
    },
  });
}
```

### B. The Streaming Handler

**File**: `artifacts/text/server.ts`

```typescript
export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    // Stream the document content
    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
      system: "Write about the given topic. Markdown is supported.",
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    // Send each word to the frontend as it generates
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true, // This means "streaming, not final"
        });
      }
    }

    return draftContent;
  },
});
```

### C. The Frontend Hook

**File**: `hooks/use-artifact.ts`

```typescript
import { create } from 'zustand';

interface ArtifactState {
  isVisible: boolean;
  currentArtifact: Artifact | null;
  
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  updateArtifactContent: (content: string) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  isVisible: false,
  currentArtifact: null,
  
  openArtifact: (artifact) => set({ 
    isVisible: true, 
    currentArtifact: artifact 
  }),
  
  closeArtifact: () => set({ 
    isVisible: false 
  }),
  
  updateArtifactContent: (content) => set((state) => ({
    currentArtifact: state.currentArtifact
      ? { ...state.currentArtifact, content }
      : null
  })),
}));
```

### D. The Data Stream Handler

**File**: `components/data-stream-handler.tsx`

```typescript
export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { openArtifact, updateArtifactContent } = useArtifactStore();

  useEffect(() => {
    if (!dataStream) return;

    for (const dataPart of dataStream) {
      // When AI creates a document
      if (dataPart.type === 'data-document-created') {
        openArtifact({
          id: dataPart.data.id,
          title: dataPart.data.title,
          content: '', // Empty at first
          kind: 'text',
        });
      }

      // As content streams in
      if (dataPart.type === 'data-textDelta') {
        updateArtifactContent(dataPart.data); // Append each word
      }
    }

    // Clean up after processing
    setDataStream(null);
  }, [dataStream]);

  return null; // This component just handles side effects
}
```

---

## Step 2: Port to Your Noname App (Day 1)

### A. Add the Tool to Your Chat Route

**Location**: `noname/server/routes/chat.ts` or `chat-agent.ts`

Find where you define tools (you already have some based on commits):

```typescript
// Your existing chat route - ADD THIS
import { createDocumentTool } from '../tools/create-document';

chatRoutes.post('/', async (c) => {
  // ... your existing setup ...

  const stream = createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      const result = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt, // Make sure prompt mentions document creation
        messages: convertToModelMessages(uiMessages),
        
        // 🎯 ADD YOUR TOOLS HERE
        tools: {
          createDocument: createDocumentTool({ 
            session, 
            dataStream, 
            db 
          }),
          // Your other tools...
        },
        
        // Make sure tools are active
        experimental_activeTools: ['createDocument'],
        
        onFinish: async ({ messages }) => {
          // Save messages...
        },
      });

      result.consumeStream();
      dataStream.merge(result.toUIMessageStream());
    },
  });

  return /* your response */;
});
```

### B. Create the Document Tool

**New File**: `noname/server/tools/create-document.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { documentsTable } from '../../database/schema';

export function createDocumentTool({ session, dataStream, db }: any) {
  return tool({
    description: `Create a document for writing, coding, or data analysis. The document will be created in a side panel. Use this when the user asks to create, write, or generate a document, article, code, or spreadsheet.`,
    
    parameters: z.object({
      title: z.string().describe('The title or name of the document'),
      kind: z.enum(['text', 'code', 'sheet']).default('text')
        .describe('Type of document: text for articles/writing, code for programs, sheet for data'),
    }),
    
    execute: async ({ title, kind }) => {
      // 1. Generate document ID
      const documentId = crypto.randomUUID();
      
      // 2. Tell frontend to open panel IMMEDIATELY
      dataStream.write({
        type: 'data-document-created',
        data: {
          id: documentId,
          title,
          kind,
          content: '', // Empty at first
        },
      });

      // 3. Stream the content generation
      let fullContent = '';
      
      const { fullStream } = await streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: kind === 'code' 
          ? 'You are a coding assistant. Write clean, well-commented code.'
          : kind === 'sheet'
          ? 'Generate CSV data with headers.'
          : 'You are a writing assistant. Write clear, engaging content with proper structure.',
        prompt: `Create a ${kind} document with title: ${title}`,
        experimental_transform: smoothStream({ chunking: 'word' }),
      });

      // 4. Stream each word to frontend
      for await (const delta of fullStream) {
        if (delta.type === 'text-delta') {
          fullContent += delta.text;
          
          // Send to frontend for live display
          dataStream.write({
            type: 'data-document-delta',
            data: {
              id: documentId,
              delta: delta.text,
            },
            transient: true, // Means "still streaming"
          });
        }
      }

      // 5. Save to database
      await db.insert(documentsTable).values({
        id: documentId,
        title,
        kind,
        content: fullContent,
        userId: session.user.id,
      });

      // 6. Tell frontend streaming is done
      dataStream.write({
        type: 'data-document-complete',
        data: {
          id: documentId,
        },
      });

      return `Created ${kind} document: "${title}"`;
    },
  });
}
```

### C. Update Your System Prompt

Make sure your system prompt tells the AI WHEN to create documents:

```typescript
const systemPrompt = `You are a helpful AI assistant.

When the user asks you to:
- Write a document, article, essay, or blog post
- Create code or a program
- Generate a spreadsheet or data table
- Make anything that would be better as a separate document

USE the createDocument tool instead of writing it in the chat.

Example user requests that should use createDocument:
- "Write me a blog post about AI"
- "Create a React component for a login form"
- "Make me a spreadsheet of expenses"
- "Generate a markdown document about climate change"

Otherwise, respond normally in the chat.`;
```

---

## Step 3: Frontend Components (Day 2)

### A. Create Artifact Store (if you don't have one)

**File**: `noname/src/stores/artifact-store.ts`

```typescript
import { create } from 'zustand';

interface Artifact {
  id: string;
  title: string;
  kind: 'text' | 'code' | 'sheet';
  content: string;
}

interface ArtifactStore {
  isVisible: boolean;
  currentArtifact: Artifact | null;
  isStreaming: boolean;
  
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  appendContent: (delta: string) => void;
  setComplete: () => void;
  updateContent: (content: string) => void; // For editing
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  isVisible: false,
  currentArtifact: null,
  isStreaming: false,
  
  openArtifact: (artifact) => {
    set({ 
      isVisible: true, 
      currentArtifact: artifact,
      isStreaming: true,
    });
  },
  
  closeArtifact: () => {
    set({ isVisible: false });
  },
  
  appendContent: (delta) => {
    set((state) => {
      if (!state.currentArtifact) return state;
      return {
        currentArtifact: {
          ...state.currentArtifact,
          content: state.currentArtifact.content + delta,
        },
      };
    });
  },
  
  setComplete: () => {
    set({ isStreaming: false });
  },
  
  updateContent: (content) => {
    set((state) => {
      if (!state.currentArtifact) return state;
      return {
        currentArtifact: {
          ...state.currentArtifact,
          content,
        },
      };
    });
  },
}));
```

### B. Handle Data Stream Events

**Add to your chat component** (wherever you use `useChat`):

```typescript
// noname/src/routes/_authenticated/ai-chat/$conversationId.tsx
import { useArtifactStore } from '@/stores/artifact-store';

function ChatPage() {
  const { openArtifact, appendContent, setComplete } = useArtifactStore();

  const { messages, sendMessage, status } = useChat({
    // ... your existing config ...
    
    onData: (dataPart) => {
      // 🎯 HANDLE ARTIFACT EVENTS
      
      // When AI creates a document
      if (dataPart.type === 'data-document-created') {
        openArtifact({
          id: dataPart.data.id,
          title: dataPart.data.title,
          kind: dataPart.data.kind,
          content: '',
        });
      }

      // As content streams in
      if (dataPart.type === 'data-document-delta') {
        appendContent(dataPart.data.delta);
      }

      // When streaming completes
      if (dataPart.type === 'data-document-complete') {
        setComplete();
      }
    },
  });

  return (
    <div className="flex h-screen">
      {/* Your chat area */}
      <div className="flex-1">
        <MessageList messages={messages} />
        <MessageInput onSend={sendMessage} />
      </div>

      {/* Artifact panel */}
      <ArtifactPanel />
    </div>
  );
}
```

### C. Create the Artifact Panel Component

**File**: `noname/src/components/artifact-panel.tsx`

```typescript
import { useArtifactStore } from '@/stores/artifact-store';
import { useState } from 'react';
import { X, Edit2, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';

export function ArtifactPanel() {
  const { 
    isVisible, 
    currentArtifact, 
    isStreaming, 
    closeArtifact,
    updateContent 
  } = useArtifactStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  if (!isVisible || !currentArtifact) return null;

  const handleStartEdit = () => {
    setEditedContent(currentArtifact.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    // Save to database
    await fetch(`/api/v1/documents/${currentArtifact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editedContent }),
    });
    
    updateContent(editedContent);
    setIsEditing(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-[600px] border-l bg-background flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1">
            <h3 className="font-semibold">{currentArtifact.title}</h3>
            {isStreaming && (
              <p className="text-sm text-muted-foreground">
                Generating...
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            {!isStreaming && !isEditing && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartEdit}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(currentArtifact.content)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={closeArtifact}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {currentArtifact.kind === 'code' ? (
                <pre className="bg-muted p-4 rounded-lg overflow-auto">
                  <code>{currentArtifact.content}</code>
                </pre>
              ) : (
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: markdownToHtml(currentArtifact.content) 
                  }} 
                />
              )}
            </div>
          )}
          
          {/* Streaming cursor effect */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Simple markdown converter (or use a library)
function markdownToHtml(markdown: string): string {
  // Use a library like 'marked' or 'react-markdown'
  // For now, simple newline handling:
  return markdown
    .split('\n\n')
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
```

---

## Step 4: Test It! (30 min)

### Test Scenarios

```bash
# Start your app
pnpm run dev
```

**In the chat, try:**

1. **"Write me a blog post about AI"**
   - Should open side panel
   - Stream content word-by-word
   - Allow editing when done

2. **"Create a React login component"**
   - Should detect it's code
   - Stream code with syntax highlighting
   - Copy button works

3. **"Make me a spreadsheet of monthly expenses"**
   - Should create sheet type
   - Stream CSV data
   - Download works

---

## The Magic Ingredients 🪄

What makes this feel so smooth:

1. **Immediate Panel Opening**
   ```typescript
   dataStream.write({
     type: 'data-document-created',
     data: { id, title, content: '' },
   });
   ```
   Panel opens BEFORE content starts streaming

2. **Word-by-Word Streaming**
   ```typescript
   experimental_transform: smoothStream({ chunking: 'word' })
   ```
   Each word appears individually, not in chunks

3. **Transient Updates**
   ```typescript
   transient: true
   ```
   Tells frontend "this is streaming, not final"

4. **Smooth Animations**
   ```typescript
   initial={{ x: '100%' }}
   animate={{ x: 0 }}
   transition={{ type: 'spring' }}
   ```
   Panel slides in beautifully

5. **Instant Editability**
   When `isStreaming` becomes `false`, edit button appears immediately

---

## Adapting to Your Custom Sidebar

Your noname app has a different layout. Here's how to adapt:

### If You Use a Drawer/Modal
```typescript
// Instead of a side panel, use your drawer component
<Drawer open={isVisible} onOpenChange={closeArtifact}>
  <DrawerContent>
    {/* Same content as above */}
  </DrawerContent>
</Drawer>
```

### If You Use Tabs
```typescript
// Add an "Artifact" tab that appears when active
{currentArtifact && (
  <Tab value="artifact">Artifact</Tab>
)}
```

### If You Have a Split View
```typescript
// Toggle between full chat and split view
<div className={isVisible ? 'grid grid-cols-2' : 'grid grid-cols-1'}>
  <ChatArea />
  {isVisible && <ArtifactPanel />}
</div>
```

---

## Expected Result

After implementation, when you type **"Write me an essay about dogs"**:

1. ⚡ **Instant** - Panel slides open (<200ms)
2. 📝 **Smooth** - Content streams word-by-word
3. ✨ **Beautiful** - Animated, polished UI
4. ⚙️ **Functional** - Edit button appears when done
5. 💾 **Reliable** - Saves to database automatically

**This is the "beautiful, smooth, fast" behavior you want!**

---

## Time Estimate

- **Reading this guide**: 15 min
- **Backend (tool + streaming)**: 2-3 hours
- **Frontend (store + panel)**: 3-4 hours  
- **Testing & polish**: 1-2 hours

**Total**: 1 day of focused work

---

## Troubleshooting

### Panel Doesn't Open
**Check**: Is `onData` in `useChat` handling `data-document-created`?

### Content Doesn't Stream Smoothly
**Check**: Did you add `experimental_transform: smoothStream({ chunking: 'word' })`?

### AI Doesn't Create Documents
**Check**: 
- Is tool in `experimental_activeTools`?
- Does system prompt mention document creation?
- Try explicitly: "Use the createDocument tool to write..."

### Edit Button Doesn't Appear
**Check**: Is `isStreaming` set to `false` when complete?

---

## Key Files to Reference

From this Next.js app:

1. **`lib/ai/tools/create-document.ts`** - Tool definition pattern
2. **`artifacts/text/server.ts`** - Streaming handler
3. **`hooks/use-artifact.ts`** - State management
4. **`components/artifact.tsx`** - Panel component
5. **`components/data-stream-handler.tsx`** - Event handling

Copy the patterns, adapt to your UI! 🎯

