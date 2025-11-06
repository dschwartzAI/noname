# MobX Migration Guide

This guide explains how to refactor your application to use MobX instead of Legend State.

## 📦 Installation

MobX and its React bindings are already installed:

```bash
pnpm add mobx mobx-react-lite
```

## 🏗️ Project Structure

```
src/
├── stores/
│   ├── auth-mobx.ts          # MobX auth store
│   ├── ai-chat-mobx.ts       # MobX AI chat store
│   └── ...                    # Add more stores as needed
├── hooks/
│   ├── use-auth-mobx.ts      # React hook for auth store
│   ├── use-ai-chat-mobx.ts   # React hook for AI chat store
│   └── ...
└── components/
    └── mobx-demo.tsx          # Demo component showing MobX usage
```

## 🎯 Key Concepts

### 1. Creating a Store

MobX stores are created as ES6 classes with `makeAutoObservable()`:

```typescript
import { makeAutoObservable, runInAction } from 'mobx'

class MyStore {
  count = 0
  isLoading = false

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  increment() {
    this.count++
  }

  async fetchData() {
    this.isLoading = true
    try {
      const data = await fetch('/api/data')
      runInAction(() => {
        this.isLoading = false
        // Update state here
      })
    } catch (error) {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  // Computed values
  get doubleCount() {
    return this.count * 2
  }
}

export const myStore = new MyStore()
```

### 2. Creating React Hooks

Create custom hooks to provide a clean API:

```typescript
import { myStore } from '@/stores/my-store'

export function useMyStore() {
  return {
    // State
    count: myStore.count,
    isLoading: myStore.isLoading,
    
    // Computed
    doubleCount: myStore.doubleCount,
    
    // Actions
    increment: myStore.increment,
    fetchData: myStore.fetchData,
  }
}
```

### 3. Using in Components

Wrap components with `observer()` to make them reactive:

```typescript
import { observer } from 'mobx-react-lite'
import { useMyStore } from '@/hooks/use-my-store'

export const MyComponent = observer(() => {
  const store = useMyStore()

  return (
    <div>
      <p>Count: {store.count}</p>
      <p>Double: {store.doubleCount}</p>
      <button onClick={store.increment}>Increment</button>
    </div>
  )
})
```

## 🔄 Migration Steps

### Step 1: Create MobX Stores

Replace Legend State stores with MobX stores:

**Before (Legend State):**
```typescript
import { observable } from '@legendapp/state'

export const counter$ = observable({
  count: 0,
  increment: () => counter$.count.set(c => c + 1)
})
```

**After (MobX):**
```typescript
import { makeAutoObservable } from 'mobx'

class CounterStore {
  count = 0

  constructor() {
    makeAutoObservable(this)
  }

  increment() {
    this.count++
  }
}

export const counterStore = new CounterStore()
```

### Step 2: Create Custom Hooks

**Before (Legend State):**
```typescript
export function useCounter() {
  const count = useSelector(() => counter$.count.get())
  return {
    count,
    increment: counter$.increment
  }
}
```

**After (MobX):**
```typescript
export function useCounter() {
  return {
    count: counterStore.count,
    increment: counterStore.increment
  }
}
```

### Step 3: Update Components

**Before (Legend State):**
```typescript
export function Counter() {
  const { count, increment } = useCounter()
  return <button onClick={increment}>{count}</button>
}
```

**After (MobX):**
```typescript
import { observer } from 'mobx-react-lite'

export const Counter = observer(() => {
  const { count, increment } = useCounter()
  return <button onClick={increment}>{count}</button>
})
```

## 📋 Example Stores Included

### 1. Auth Store (`auth-mobx.ts`)

Features:
- User authentication state
- Sign in/up/out actions
- Session management
- Computed properties (isAuthenticated, userEmail, etc.)

Usage:
```typescript
import { useAuthMobx, observer } from '@/hooks/use-auth-mobx'

export const ProfilePage = observer(() => {
  const auth = useAuthMobx()
  
  if (!auth.isAuthenticated) {
    return <div>Please sign in</div>
  }
  
  return <div>Welcome, {auth.userName}!</div>
})
```

### 2. AI Chat Store (`ai-chat-mobx.ts`)

Features:
- Message management
- Chat settings
- WebSocket state
- Streaming support
- Computed properties (messageCount, canSendMessage, etc.)

Usage:
```typescript
import { useAIChatMobx, observer } from '@/hooks/use-ai-chat-mobx'

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

## 🎨 Demo Component

A complete demo component is available at `src/components/mobx-demo.tsx` showing:
- Auth store usage
- AI chat store usage
- Message history with auto-updates
- Interactive controls
- MobX best practices

## 🔑 Key Differences from Legend State

| Feature | Legend State | MobX |
|---------|-------------|------|
| Store Creation | `observable({})` | `class` + `makeAutoObservable()` |
| Component Updates | Auto (via `useSelector`) | Requires `observer()` HOC |
| State Updates | `.set()` method | Direct assignment |
| Async Actions | Direct | Use `runInAction()` |
| Computed Values | `computed$` | `get` keyword |
| Bundle Size | ~10KB | ~16KB |
| TypeScript | Good | Excellent |

## ✅ Benefits of MobX

1. **Less Boilerplate**: `makeAutoObservable()` handles everything automatically
2. **Better TypeScript**: Full type inference without manual typing
3. **Familiar Patterns**: Uses standard JS classes and properties
4. **Mature Ecosystem**: Battle-tested with 10+ years of development
5. **Great DevTools**: Excellent debugging tools available
6. **Performance**: Automatically optimized with computed values

## 🚀 Next Steps

1. **Try the Demo**: Visit `/mobx-demo` route to see MobX in action
2. **Migrate Gradually**: Start with one store at a time
3. **Update Components**: Add `observer()` wrapper as you migrate
4. **Remove Legend State**: Once migration is complete, uninstall `@legendapp/state`

## 📚 Resources

- [MobX Documentation](https://mobx.js.org/)
- [MobX React Integration](https://mobx.js.org/react-integration.html)
- [MobX Best Practices](https://mobx.js.org/best-practices.html)
- [MobX DevTools](https://github.com/mobxjs/mobx-devtools)

## 💡 Tips

1. Always use `observer()` on components that read MobX state
2. Use `runInAction()` for async state updates
3. Keep stores focused on single concerns
4. Use computed properties for derived state
5. Enable strict mode in development for better error messages

## 🐛 Common Issues

### Components not updating?
- Make sure you wrapped the component with `observer()`
- Check that the store is created with `makeAutoObservable()`

### Async actions not working?
- Wrap state updates in `runInAction()` after async calls

### TypeScript errors?
- Ensure you're using `mobx@6+` for full TS support
- Enable `useDefineForClassFields: true` in tsconfig.json

---

Happy coding with MobX! 🎉

