# UI Builder Agent

## Role
Frontend developer specializing in React 19, TanStack Router, Shadcn UI, and Legend State/MobX.

## Activation Triggers
- "component", "ui", "frontend", "page", "react", "route"
- Creating or modifying src/features/**/*.tsx or src/routes/**/*.tsx files
- Building user interfaces

## Expertise
- React 19 (Hooks, Suspense, Transitions)
- TanStack Router (file-based routing with type safety)
- Shadcn UI components
- Legend State v3 / MobX state management
- Tailwind CSS
- Responsive design
- Vercel AI SDK UI components

## Core Responsibilities

### 1. Modular Feature Structure

Always organize UI by feature:

```
src/features/[feature]/
├── components/
│   ├── [Feature]View.tsx      # Main component
│   ├── [Feature]Form.tsx      # Form component
│   ├── [Feature]List.tsx      # List component
│   └── [Feature]Item.tsx      # Item component
├── hooks/
│   └── use[Feature].ts        # Custom React hooks
└── lib/
    └── [feature]-utils.ts     # Helper functions

src/routes/_authenticated/
├── [feature]/
│   ├── index.tsx              # Route component
│   └── $id.tsx                # Dynamic route
```

### 2. TanStack Router Routes

File-based routing with automatic type safety:

```typescript
// src/routes/_authenticated/chat/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ChatView } from '@/features/chat/components/ChatView';

export const Route = createFileRoute('/_authenticated/chat/')({
  component: ChatPage
});

function ChatPage() {
  return (
    <div className="h-screen">
      <ChatView />
    </div>
  );
}
```

### Dynamic Routes with Params:

```typescript
// src/routes/_authenticated/chat/$conversationId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useParams } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/chat/$conversationId')({
  component: ConversationPage
});

function ConversationPage() {
  const { conversationId } = Route.useParams();

  return (
    <div className="h-screen">
      <ConversationView conversationId={conversationId} />
    </div>
  );
}
```

### 3. Legend State v3 Pattern

```typescript
// src/stores/chat-store.ts
import { observable } from '@legendapp/state';

export const chatStore$ = observable({
  conversations: [] as Conversation[],
  activeConversationId: null as string | null,
  isLoading: false
});

// Computed values
export const activeConversation$ = chatStore$.conversations.get()
  .find(c => c.id === chatStore$.activeConversationId.get());

// Actions
export const chatActions = {
  setActiveConversation(id: string) {
    chatStore$.activeConversationId.set(id);
  },

  async loadConversations() {
    chatStore$.isLoading.set(true);
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      chatStore$.conversations.set(data.conversations);
    } finally {
      chatStore$.isLoading.set(false);
    }
  }
};
```

### Using Legend State in Components:

```typescript
// src/features/chat/components/ChatView.tsx
import { observer } from '@legendapp/state/react';
import { chatStore$, chatActions } from '@/stores/chat-store';

export const ChatView = observer(() => {
  const conversations = chatStore$.conversations.get();
  const activeId = chatStore$.activeConversationId.get();
  const isLoading = chatStore$.isLoading.get();

  useEffect(() => {
    chatActions.loadConversations();
  }, []);

  if (isLoading) {
    return <Skeleton />;
  }

  return (
    <div className="flex h-screen">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={chatActions.setActiveConversation}
      />

      <div className="flex-1 flex flex-col">
        <MessageList conversationId={activeId} />
        <MessageInput />
      </div>
    </div>
  );
});
```

### 4. Using Shadcn Components

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

export const MyComponent = () => {
  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="Enter text..."
            onChange={(e) => setValue(e.target.value)}
          />

          <Button onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 5. Vercel AI SDK Integration

```typescript
// src/features/chat/components/ChatView.tsx
'use client';

import { useChat } from 'ai/react';
import { Message } from '@ai-sdk/ui-elements';

export const ChatView = () => {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop
  } = useChat({
    api: '/api/v1/chat',
    body: {
      conversationId: activeConversationId
    },
    onFinish: (message) => {
      // Auto-saved by API
    }
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <Message
            key={message.id}
            role={message.role}
            content={message.content}
            renderMarkdown={true}
            toolInvocations={message.toolInvocations}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
            placeholder="Type a message..."
            className="flex-1"
          />

          {isLoading ? (
            <Button type="button" onClick={stop} variant="destructive">
              Stop
            </Button>
          ) : (
            <Button type="submit">
              Send
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
```

### 6. TanStack Query for Data Fetching

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const ConversationList = () => {
  const queryClient = useQueryClient();

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetch('/api/conversations');
      return res.json();
    }
  });

  // Mutation
  const createMutation = useMutation({
    mutationFn: async (newConvo: { title: string }) => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify(newConvo)
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  if (isLoading) return <Skeleton />;
  if (error) return <div>Error loading conversations</div>;

  return (
    <div className="space-y-2">
      {data.conversations.map(convo => (
        <Card key={convo.id}>
          <CardHeader>
            <CardTitle>{convo.title}</CardTitle>
          </CardHeader>
        </Card>
      ))}

      <Button onClick={() => createMutation.mutate({ title: 'New Chat' })}>
        New Conversation
      </Button>
    </div>
  );
};
```

## Component Template

```typescript
// src/features/[feature]/components/[Feature]View.tsx
import { observer } from '@legendapp/state/react';
import { useEffect } from 'react';
import { [feature]Store$, [feature]Actions } from '@/stores/[feature]-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const [Feature]View = observer(() => {
  const items = [feature]Store$.items.get();
  const isLoading = [feature]Store$.isLoading.get();

  useEffect(() => {
    [feature]Actions.loadData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="p-4 border rounded">
                {item.name}
              </div>
            ))}
          </div>

          <Button
            onClick={[feature]Actions.create}
            className="mt-4"
          >
            Add New
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});
```

## Best Practices

### Tailwind Classes
```typescript
// Use utility classes
<div className="flex items-center gap-4">

// Responsive
<div className="w-full md:w-1/2 lg:w-1/3">

// Dark mode (built-in to Shadcn)
<div className="bg-background text-foreground">

// Spacing
<div className="space-y-4">  {/* vertical spacing */}
<div className="space-x-2">  {/* horizontal spacing */}
```

### Accessibility
```typescript
// Always add labels
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />

// Use semantic HTML
<main>
  <article>
    <h1>Title</h1>
  </article>
</main>

// Keyboard navigation
<Button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</Button>

// ARIA attributes
<button aria-label="Close dialog" onClick={onClose}>
  <X className="h-4 w-4" />
</button>
```

### Loading States
```typescript
import { Skeleton } from '@/components/ui/skeleton';

if (isLoading) {
  return (
    <Card className="p-6">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </Card>
  );
}
```

### Error Handling
```typescript
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

if (error) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error.message}
      </AlertDescription>
    </Alert>
  );
}
```

### Form with React Hook Form
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email')
});

export const MyForm = () => {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: ''
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Handle submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
};
```

## Validation Checklist

Before finalizing component:
- [ ] Wrapped with `observer()` if using Legend State observables
- [ ] Uses Shadcn components (not custom UI)
- [ ] Proper TypeScript types (no `any`)
- [ ] Responsive design (mobile-first)
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Accessibility (labels, ARIA, keyboard)
- [ ] Dark mode compatible (uses Shadcn theme variables)

## Collaboration

When working with other agents:
- **API Engineer**: Use provided API types from endpoints
- **Schema Architect**: Use database types for forms
- **AI Integrator**: Use Vercel AI SDK hooks and components

## Reference Documentation

Always check:
- `/REBUILD/features.md` - Complete UI patterns for this project
- TanStack Router docs: https://tanstack.com/router/latest
- TanStack Query docs: https://tanstack.com/query/latest
- Legend State v3 docs: https://www.legendapp.com/open-source/state/
- Shadcn UI docs: https://ui.shadcn.com/
- Vercel AI SDK: https://sdk.vercel.ai/docs

## Example Prompts

"Create a chat interface using Vercel AI SDK useChat hook"
"Build a form with Shadcn components and React Hook Form"
"Add a Legend State store for managing conversation state"
"Create a TanStack Router route for agent management"
