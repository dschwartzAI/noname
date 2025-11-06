# Internal Chat System Implementation Guide

> **Goal**: Build robust internal DM + Group messaging using Cloudflare Durable Objects + ShadFlareAi components.

---

## 🏗️ Architecture Overview

```
Frontend (React)
    ↓ WebSocket
Cloudflare Worker
    ↓
Durable Object (ChatRoom)
    ↓ (persist)
Neon Postgres (message history)
```

**Key Components:**

1. **Durable Objects**: Stateful WebSocket rooms
2. **Neon Postgres**: Permanent message storage
3. **ShadFlareAi Chat UI**: Reuse existing components
4. **Presence System**: Who's online/typing

---

## 📊 Database Schema

**Already created in** `db/schema/chat.ts`:

- `chat_rooms` - DM or Group rooms
- `chat_room_members` - Who's in which room
- `chat_messages` - Message history
- `typing_indicators` - Ephemeral typing state

---

## 🔧 Step 1: Create Durable Object (Week 7)

### 1.1 Define Durable Object

```typescript
// worker/durable-objects/ChatRoomDO.ts

export class ChatRoomDO {
  state: DurableObjectState;
  env: Env;
  
  // In-memory participants (WebSocket connections)
  sessions: Map<string, WebSocket> = new Map();
  
  // Ephemeral state (who's typing)
  typingUsers: Set<string> = new Set();
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Restore state from storage if needed
    this.state.blockConcurrencyWhile(async () => {
      // Load any persisted state
    });
  }
  
  async fetch(request: Request) {
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      await this.handleSession(server, request);
      
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }
    
    return new Response('Expected WebSocket', { status: 400 });
  }
  
  async handleSession(ws: WebSocket, request: Request) {
    ws.accept();
    
    // Extract user info from request (auth)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const roomId = url.searchParams.get('roomId');
    
    if (!userId || !roomId) {
      ws.close(1008, 'Missing userId or roomId');
      return;
    }
    
    // Add to sessions
    this.sessions.set(userId, ws);
    
    // Notify others that user joined
    this.broadcast({
      type: 'user_joined',
      userId,
      timestamp: Date.now()
    }, userId);
    
    // Send current online users to new user
    ws.send(JSON.stringify({
      type: 'online_users',
      users: Array.from(this.sessions.keys())
    }));
    
    // Handle messages
    ws.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data as string);
      await this.handleMessage(data, userId, roomId);
    });
    
    // Handle disconnect
    ws.addEventListener('close', () => {
      this.sessions.delete(userId);
      this.typingUsers.delete(userId);
      
      this.broadcast({
        type: 'user_left',
        userId,
        timestamp: Date.now()
      }, userId);
    });
  }
  
  async handleMessage(data: any, userId: string, roomId: string) {
    switch (data.type) {
      case 'message':
        await this.handleChatMessage(data, userId, roomId);
        break;
        
      case 'typing':
        this.handleTyping(userId, data.isTyping);
        break;
        
      case 'reaction':
        await this.handleReaction(data, userId, roomId);
        break;
    }
  }
  
  async handleChatMessage(data: any, userId: string, roomId: string) {
    // Save to database
    const db = getDb(this.env);
    const [message] = await db.insert(chatMessages).values({
      tenantId: data.tenantId,
      roomId,
      userId,
      content: data.content,
      contentType: data.contentType || 'text',
      attachments: data.attachments
    }).returning();
    
    // Broadcast to all participants
    this.broadcast({
      type: 'new_message',
      message
    });
  }
  
  handleTyping(userId: string, isTyping: boolean) {
    if (isTyping) {
      this.typingUsers.add(userId);
    } else {
      this.typingUsers.delete(userId);
    }
    
    // Broadcast typing status
    this.broadcast({
      type: 'typing',
      userId,
      isTyping,
      typingUsers: Array.from(this.typingUsers)
    }, userId);
  }
  
  async handleReaction(data: any, userId: string, roomId: string) {
    const db = getDb(this.env);
    
    // Update message reactions
    const message = await db.query.chatMessages.findFirst({
      where: eq(chatMessages.id, data.messageId)
    });
    
    if (!message) return;
    
    const reactions = message.reactions || {};
    const emoji = data.emoji;
    
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    
    if (data.action === 'add') {
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }
    } else {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }
    
    await db.update(chatMessages)
      .set({ reactions })
      .where(eq(chatMessages.id, data.messageId));
    
    // Broadcast reaction update
    this.broadcast({
      type: 'reaction_update',
      messageId: data.messageId,
      reactions
    });
  }
  
  broadcast(message: any, excludeUserId?: string) {
    const payload = JSON.stringify(message);
    
    for (const [userId, ws] of this.sessions.entries()) {
      if (userId !== excludeUserId) {
        ws.send(payload);
      }
    }
  }
}
```

### 1.2 Register Durable Object

```typescript
// wrangler.toml

[durable_objects]
bindings = [
  { name = "CHAT_ROOM", class_name = "ChatRoomDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["ChatRoomDO"]
```

---

## 🎨 Step 2: Frontend Chat UI (Week 7)

### 2.1 WebSocket Hook

```typescript
// src/features/chat/hooks/useChatRoom.ts

import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

export function useChatRoom(roomId: string, userId: string) {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Connect to Durable Object
    const wsUrl = `wss://your-worker.workers.dev/chat?roomId=${roomId}&userId=${userId}`;
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      setIsConnected(true);
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'online_users':
          setOnlineUsers(data.users);
          break;
          
        case 'new_message':
          setMessages((prev) => [...prev, data.message]);
          break;
          
        case 'typing':
          setTypingUsers(data.typingUsers.filter((id: string) => id !== userId));
          break;
          
        case 'reaction_update':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId ? { ...m, reactions: data.reactions } : m
            )
          );
          break;
          
        case 'user_joined':
          setOnlineUsers((prev) => [...prev, data.userId]);
          break;
          
        case 'user_left':
          setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
          break;
      }
    };
    
    ws.current.onclose = () => {
      setIsConnected(false);
    };
    
    return () => {
      ws.current?.close();
    };
  }, [roomId, userId]);
  
  const sendMessage = (content: string, attachments?: any[]) => {
    ws.current?.send(JSON.stringify({
      type: 'message',
      content,
      contentType: 'text',
      attachments,
      tenantId: 'current-tenant-id' // Get from context
    }));
  };
  
  const sendTyping = (isTyping: boolean) => {
    ws.current?.send(JSON.stringify({
      type: 'typing',
      isTyping
    }));
  };
  
  const sendReaction = (messageId: string, emoji: string, action: 'add' | 'remove') => {
    ws.current?.send(JSON.stringify({
      type: 'reaction',
      messageId,
      emoji,
      action
    }));
  };
  
  return {
    messages,
    onlineUsers,
    typingUsers,
    isConnected,
    sendMessage,
    sendTyping,
    sendReaction
  };
}
```

### 2.2 Chat Room Component

```typescript
// src/features/chat/components/ChatRoom.tsx

import { observer } from 'mobx-react-lite';
import { useChatRoom } from '../hooks/useChatRoom';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { OnlineUsers } from './OnlineUsers';
import { TypingIndicator } from './TypingIndicator';

export const ChatRoom = observer(({ roomId, userId }: Props) => {
  const {
    messages,
    onlineUsers,
    typingUsers,
    isConnected,
    sendMessage,
    sendTyping,
    sendReaction
  } = useChatRoom(roomId, userId);
  
  return (
    <div className="flex h-screen">
      {/* Sidebar: Online Users */}
      <div className="w-64 border-r p-4">
        <h3 className="font-semibold mb-4">Online ({onlineUsers.length})</h3>
        <OnlineUsers users={onlineUsers} />
      </div>
      
      {/* Main: Messages */}
      <div className="flex-1 flex flex-col">
        {!isConnected && (
          <div className="bg-yellow-100 p-2 text-center">
            Reconnecting...
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList 
            messages={messages}
            onReaction={sendReaction}
          />
        </div>
        
        <div className="p-4 border-t">
          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
          
          <MessageInput
            onSend={sendMessage}
            onTyping={sendTyping}
          />
        </div>
      </div>
    </div>
  );
});
```

---

## 🚀 Step 3: API Routes (Week 8)

### 3.1 Create Room

```typescript
// worker/routes/chat.ts

import { Hono } from 'hono';

const app = new Hono();

app.post('/rooms/create', async (c) => {
  const { type, name, participantIds } = await c.req.json();
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  const db = getDb(c.env);
  
  // Create room
  const [room] = await db.insert(chatRooms).values({
    tenantId,
    type,
    name,
    participantIds,
    createdBy: userId
  }).returning();
  
  // Add members
  await db.insert(chatRoomMembers).values(
    participantIds.map((pid: string) => ({
      tenantId,
      roomId: room.id,
      userId: pid,
      role: pid === userId ? 'owner' : 'member'
    }))
  );
  
  return c.json({ room });
});

app.get('/rooms/list', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  const db = getDb(c.env);
  
  // Get rooms user is member of
  const rooms = await db.query.chatRooms.findMany({
    where: and(
      eq(chatRooms.tenantId, tenantId),
      exists(
        db.select().from(chatRoomMembers)
          .where(and(
            eq(chatRoomMembers.roomId, chatRooms.id),
            eq(chatRoomMembers.userId, userId)
          ))
      )
    ),
    with: {
      members: true
    },
    orderBy: desc(chatRooms.lastMessageAt)
  });
  
  return c.json({ rooms });
});

export default app;
```

---

## 📱 Step 4: Use ShadFlareAi Components (Week 8)

**ShadFlareAi already has chat components!**

Reuse from `src/components/chat/`:
- `chat-bubble.tsx` - Message bubble
- `chat-input.tsx` - Input field
- `chat-message-list.tsx` - Message list

**Adapt for internal chat:**

```typescript
// src/features/chat/components/MessageList.tsx

import { ChatBubble } from '@/components/chat/chat-bubble';

export function MessageList({ messages, onReaction }: Props) {
  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <ChatBubble
          key={message.id}
          variant={message.userId === currentUserId ? 'sent' : 'received'}
          onReaction={(emoji) => onReaction(message.id, emoji, 'add')}
        >
          <div>{message.content}</div>
          
          {/* Reactions */}
          {message.reactions && (
            <div className="flex gap-1 mt-1">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  className="text-xs bg-gray-100 rounded px-2 py-1"
                  onClick={() => onReaction(message.id, emoji, 'remove')}
                >
                  {emoji} {users.length}
                </button>
              ))}
            </div>
          )}
        </ChatBubble>
      ))}
    </div>
  );
}
```

---

## ✅ Features Checklist

### Week 7: Core Chat System
- [ ] Durable Object for WebSocket rooms
- [ ] Direct messaging (1-on-1)
- [ ] Group channels (many-to-many)
- [ ] Message persistence to Postgres
- [ ] Real-time delivery
- [ ] Online presence

### Week 8: Advanced Features
- [ ] Typing indicators
- [ ] Message reactions
- [ ] Message threading (replies)
- [ ] File attachments
- [ ] Read receipts
- [ ] Notification settings per room

---

## 🔐 Security Considerations

1. **Authentication**: Validate JWT in WebSocket upgrade
2. **Authorization**: Check user is room member
3. **Rate Limiting**: Limit messages per user per second
4. **Content Moderation**: Filter spam/abuse (optional)
5. **Encryption**: Use HTTPS for WebSocket (wss://)

---

## 📊 Performance Optimization

1. **Message Pagination**: Load last 50 messages, infinite scroll
2. **Lazy Loading**: Load older messages on demand
3. **Optimistic Updates**: Show message immediately, confirm later
4. **Reconnection Logic**: Auto-reconnect on disconnect
5. **Batch Updates**: Batch typing indicators (debounce)

---

## 🧪 Testing

```typescript
// test/chat.test.ts

describe('Chat System', () => {
  it('should create a room', async () => {
    const response = await fetch('/api/chat/rooms/create', {
      method: 'POST',
      body: JSON.stringify({
        type: 'direct',
        participantIds: ['user1', 'user2']
      })
    });
    
    expect(response.status).toBe(200);
    const { room } = await response.json();
    expect(room.type).toBe('direct');
  });
  
  it('should send and receive messages', async () => {
    // Test WebSocket connection
    // Test message delivery
    // Test typing indicators
  });
});
```

---

**Next**: Implement this in Week 7-8 after core AI chat is done!