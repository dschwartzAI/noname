# 🏪 MobX Stores

Centralized state management using MobX for reactive, type-safe state.

---

## 📋 Available Stores

### 1. **Auth Store** (`auth-mobx.ts`)
Manages user authentication and session state.

**State:**
- `user: User | null` - Current user
- `session: Session | null` - Active session
- `isLoading: boolean` - Loading state
- `error: Error | null` - Error state

**Computed:**
- `isAuthenticated` - Whether user is logged in
- `userEmail` - User's email address
- `userName` - User's display name

**Actions:**
- `signIn(email, password)` - Sign in user
- `signUp(email, password, name)` - Register new user
- `signOut()` - Sign out current user
- `refreshSession()` - Refresh session data

**Usage:**
```typescript
import { observer } from 'mobx-react-lite'
import { useAuthMobx } from '@/stores'

export const ProfilePage = observer(() => {
  const auth = useAuthMobx()
  
  if (!auth.isAuthenticated) {
    return <div>Please sign in</div>
  }
  
  return <div>Welcome, {auth.userName}!</div>
})
```

---

### 2. **AI Chat Store** (`ai-chat-mobx.ts`)
Manages chat messages, settings, and WebSocket state.

**State:**
- `messages: ChatMessage[]` - Chat history
- `input: string` - Current input text
- `isStreaming: boolean` - Streaming state
- `settings: ChatSettings` - Chat configuration
- `websocket: WebSocketState` - WebSocket connection state

**Computed:**
- `messageCount` - Total number of messages
- `lastMessage` - Most recent message
- `hasMessages` - Whether chat has messages
- `canSendMessage` - Whether message can be sent

**Actions:**
- `addMessage(message)` - Add a message
- `updateMessage(id, updates)` - Update existing message
- `removeMessage(id)` - Delete a message
- `clearMessages()` - Clear all messages
- `setInput(value)` - Update input text
- `sendMessage(content)` - Send a new message
- `updateSettings(updates)` - Update chat settings

**Usage:**
```typescript
import { observer } from 'mobx-react-lite'
import { useAIChatMobx } from '@/stores'

export const ChatInterface = observer(() => {
  const chat = useAIChatMobx()
  
  return (
    <div>
      <div>Messages: {chat.messageCount}</div>
      <input 
        value={chat.input}
        onChange={(e) => chat.setInput(e.target.value)}
      />
      <button 
        onClick={() => chat.sendMessage(chat.input)}
        disabled={!chat.canSendMessage}
      >
        Send
      </button>
    </div>
  )
})
```

---

### 3. **Config Store** (`config-mobx.ts`)
Global application configuration with automatic localStorage persistence.

**State:**
- `theme: 'light' | 'dark' | 'system'` - App theme
- `sidebarOpen: boolean` - Sidebar visibility
- `sidebarCollapsed: boolean` - Sidebar collapsed state
- `language: string` - App language
- `notifications: boolean` - Notifications enabled

**Computed:**
- `config` - Full config object

**Actions:**
- `setTheme(theme)` - Change theme
- `setSidebarOpen(open)` - Set sidebar visibility
- `toggleSidebar()` - Toggle sidebar
- `toggleSidebarCollapsed()` - Toggle collapsed state
- `setLanguage(language)` - Change language
- `setNotifications(enabled)` - Toggle notifications
- `reset()` - Reset to defaults

**Usage:**
```typescript
import { observer } from 'mobx-react-lite'
import { useConfigMobx } from '@/stores'

export const SettingsPage = observer(() => {
  const config = useConfigMobx()
  
  return (
    <div>
      <button onClick={() => config.setTheme('dark')}>
        Dark Mode
      </button>
      <button onClick={() => config.toggleSidebar()}>
        Toggle Sidebar
      </button>
    </div>
  )
})
```

---

## 🎯 Store Architecture

### Creating Stores

All stores follow this pattern:

```typescript
import { makeAutoObservable, runInAction } from 'mobx'

class MyStore {
  // Observable state
  value = 0
  isLoading = false
  
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }
  
  // Computed values
  get doubleValue() {
    return this.value * 2
  }
  
  // Synchronous actions
  increment() {
    this.value++
  }
  
  // Async actions
  async fetchData() {
    this.isLoading = true
    try {
      const data = await api.getData()
      runInAction(() => {
        this.value = data
        this.isLoading = false
      })
    } catch (error) {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }
}

export const myStore = new MyStore()
```

### Using Stores in Components

Components must be wrapped with `observer()` to react to state changes:

```typescript
import { observer } from 'mobx-react-lite'
import { myStore } from '@/stores/my-store'

export const MyComponent = observer(() => {
  return (
    <div>
      <p>Value: {myStore.value}</p>
      <p>Double: {myStore.doubleValue}</p>
      <button onClick={() => myStore.increment()}>
        Increment
      </button>
    </div>
  )
})
```

### Creating Custom Hooks

Wrap store access in custom hooks for better ergonomics:

```typescript
// hooks/use-my-store.ts
import { myStore } from '@/stores/my-store'

export function useMyStore() {
  return {
    // State
    value: myStore.value,
    isLoading: myStore.isLoading,
    
    // Computed
    doubleValue: myStore.doubleValue,
    
    // Actions
    increment: myStore.increment,
    fetchData: myStore.fetchData,
  }
}

// Then in components:
export const MyComponent = observer(() => {
  const store = useMyStore()
  return <div>{store.value}</div>
})
```

---

## 🔧 Store Utilities

### Debug State

```typescript
import { storeUtils } from '@/stores'

// Get all store states
console.log(storeUtils.getDebugState())

// Reset all stores
storeUtils.resetAll()
```

### Development Mode

In development, stores are attached to `window` for debugging:

```javascript
// In browser console:
window.__MOBX_STORES__.auth
window.__MOBX_STORES__.aiChat
window.__MOBX_STORES__.config
window.__MOBX_STORES__.getDebugState()
```

---

## 🚀 Best Practices

### 1. Always Use `observer()`
Components that read MobX state must be wrapped:

```typescript
// ✅ Good
export const MyComponent = observer(() => {
  const chat = useAIChatMobx()
  return <div>{chat.messageCount}</div>
})

// ❌ Bad - won't react to changes
export const MyComponent = () => {
  const chat = useAIChatMobx()
  return <div>{chat.messageCount}</div>
}
```

### 2. Use `runInAction` for Async Updates

```typescript
// ✅ Good
async fetchData() {
  try {
    const data = await api.getData()
    runInAction(() => {
      this.data = data
      this.isLoading = false
    })
  } catch (error) {
    runInAction(() => {
      this.error = error
      this.isLoading = false
    })
  }
}

// ❌ Bad - direct assignment in async context
async fetchData() {
  const data = await api.getData()
  this.data = data // Warning in strict mode!
}
```

### 3. Keep Stores Focused

Each store should have a single responsibility:

```typescript
// ✅ Good - focused stores
authStore      // Only auth
chatStore      // Only chat
configStore    // Only config

// ❌ Bad - god object
appStore       // Everything!
```

### 4. Use Computed Values

MobX automatically memoizes computed values:

```typescript
// ✅ Good - computed value
get totalPrice() {
  return this.items.reduce((sum, item) => sum + item.price, 0)
}

// ❌ Bad - recalculated every render
getTotalPrice() {
  return this.items.reduce((sum, item) => sum + item.price, 0)
}
```

---

## 📚 Resources

- [MobX Documentation](https://mobx.js.org/)
- [MobX React Integration](https://mobx.js.org/react-integration.html)
- [MobX Best Practices](https://mobx.js.org/best-practices.html)
- [MobX DevTools](https://github.com/mobxjs/mobx-devtools)
- [Migration Guide](../MOBX_MIGRATION_GUIDE.md)

---

## 🔄 Migration from Legend State

If you're migrating from Legend State:

1. Replace `observable({})` with class-based stores
2. Use `makeAutoObservable()` in constructor
3. Wrap components with `observer()`
4. Use `runInAction()` for async updates
5. Access state directly (no `.get()` needed)

See [MOBX_MIGRATION_GUIDE.md](../MOBX_MIGRATION_GUIDE.md) for details.

---

**Happy state managing! 🎉**
