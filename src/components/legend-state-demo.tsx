/**
 * Legend State v3 Demo Component
 * 
 * Demonstrates the modular observable system with live state inspection
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonViewer } from '@/components/ui/json-viewer'
import { 
  useAuth,
  useAuthState, 
  useAIChatMobx,
  storeUtils,
  observer
} from '@/stores'

export const LegendStateDemo = observer(() => {
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Auth state using Better Auth
  const { user, isAuthenticated, error: authError } = useAuthState()
  
  // AI Chat state using MobX
  const chat = useAIChatMobx()
  
  // Full store states for JSON view
  const fullAuthState = useAuth()
  
  // Force refresh for demo
  const refresh = () => setRefreshKey(prev => prev + 1)
  
  useEffect(() => {
    // Auto-refresh every 2 seconds for demo
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="space-y-6" key={refreshKey}>
      <Card>
        <CardHeader>
          <CardTitle>⚡ MobX State Management Demo</CardTitle>
          <CardDescription>
            Fast, reactive state management with MobX observables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={() => storeUtils.resetAll()}
              variant="destructive"
              size="sm"
            >
              Reset All Stores
            </Button>
            <Button 
              onClick={() => console.log('Debug state:', storeUtils.getDebugState())}
              variant="outline"
              size="sm"
            >
              Log Debug State
            </Button>
            <Button onClick={refresh} variant="ghost" size="sm">
              Refresh View
            </Button>
          </div>
          
          {/* Store Status Overview */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🔐 Auth Observable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={isAuthenticated ? "default" : "secondary"}>
                    {isAuthenticated ? "Authenticated" : "Guest"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">User:</span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email || "None"}
                  </span>
                </div>
                {authError && (
                  <div className="text-xs text-red-500">
                    Error: {authError}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🤖 AI Chat Observable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Messages:</span>
                  <Badge variant="outline">
                    {chat.messageCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">WebSocket:</span>
                  <Badge variant={chat.websocket.isConnected ? "default" : "secondary"}>
                    {chat.websocket.isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model:</span>
                  <span className="text-xs text-muted-foreground">
                    {chat.settings.selectedModel}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      {/* Interactive Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎮 Interactive MobX Actions</CardTitle>
          <CardDescription>
            Test observable actions and see real-time reactive updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth">
            <TabsList>
              <TabsTrigger value="auth">Auth Actions</TabsTrigger>
              <TabsTrigger value="chat">Chat Actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="auth" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-sm text-muted-foreground col-span-2">
                  Auth actions are now handled by Better Auth. Use the actual sign-in/sign-out UI instead.
                </p>
                {/* Auth actions disabled - now using Better Auth
                <Button 
                  onClick={() => authActions.setUser({
                    accountNo: 'demo-123',
                    email: 'legend@example.com',
                    role: ['user'],
                    exp: Date.now() + 3600000,
                    displayName: 'Legend State User'
                  })}
                  size="sm"
                >
                  Set Legend User
                </Button>
                <Button 
                  onClick={() => authActions.logout()}
                  variant="outline"
                  size="sm"
                >
                  Logout
                </Button>
                <Button 
                  onClick={() => authActions.setError('Legend State demo error')}
                  variant="destructive"
                  size="sm"
                >
                  Set Error
                </Button>
                <Button 
                  onClick={() => authActions.setError(null)}
                  variant="ghost"
                  size="sm"
                >
                  Clear Error
                </Button>
                */}
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => chat.addMessage({
                    role: 'user',
                    content: 'This is a MobX demo message! ⚡',
                  })}
                  size="sm"
                >
                  Add User Message
                </Button>
                <Button 
                  onClick={() => chat.addMessage({
                    role: 'assistant',
                    content: 'This is a demo AI response powered by MobX! 🚀',
                  })}
                  variant="outline"
                  size="sm"
                >
                  Add AI Message
                </Button>
                <Button 
                  onClick={() => chat.clearMessages()}
                  variant="destructive"
                  size="sm"
                >
                  Clear Messages
                </Button>
                <Button 
                  onClick={() => chat.updateSettings({
                    selectedModel: chat.settings.selectedModel === 'llama-3.1-8b-instruct' 
                      ? 'mistral-7b' 
                      : 'llama-3.1-8b-instruct'
                  })}
                  variant="ghost"
                  size="sm"
                >
                  Toggle Model
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* MobX Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ MobX Features</CardTitle>
          <CardDescription>
            Key advantages of MobX for state management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🚀 Performance</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Transparent reactivity</li>
                <li>• Minimal re-renders with observer()</li>
                <li>• Battle-tested performance</li>
                <li>• ~16KB bundle size</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🧠 Developer Experience</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Minimal boilerplate</li>
                <li>• makeAutoObservable() magic</li>
                <li>• Excellent TypeScript support</li>
                <li>• Familiar class-based patterns</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🔄 Reactivity</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Automatic dependency tracking</li>
                <li>• Computed values with get</li>
                <li>• runInAction for async</li>
                <li>• Deep observable objects</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🎯 Ecosystem</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• 10+ years of development</li>
                <li>• Large community support</li>
                <li>• Great debugging tools</li>
                <li>• Production-ready</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* State Inspection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 MobX Store Inspection</CardTitle>
          <CardDescription>
            Live view of MobX store state (updates every 2s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth-state">
            <TabsList>
              <TabsTrigger value="auth-state">Auth Store</TabsTrigger>
              <TabsTrigger value="chat-state">Chat Store</TabsTrigger>
            </TabsList>
            
            <TabsContent value="auth-state">
              <div className="max-h-96 overflow-auto">
                <JsonViewer data={fullAuthState} />
              </div>
            </TabsContent>
            
            <TabsContent value="chat-state">
              <div className="max-h-96 overflow-auto">
                <JsonViewer data={{
                  messages: chat.messages,
                  settings: chat.settings,
                  websocket: chat.websocket,
                  messageCount: chat.messageCount,
                  isStreaming: chat.isStreaming,
                }} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
})