/**
 * Store Demo Component
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
  useAIChatMobx,
  storeUtils,
  observer
} from '@/stores'

export const StoreDemo = observer(() => {
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Auth state from Better Auth
  const { user: authUser, isAuthenticated, error: authError } = useAuth()
  
  // AI Chat store from MobX
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
          <CardTitle>🔧 Modular Observable System Demo</CardTitle>
          <CardDescription>
            Real-time state management with Zustand-based observables
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
                <CardTitle className="text-sm">🔐 Auth Store</CardTitle>
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
                    {authUser?.email || "None"}
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
                <CardTitle className="text-sm">🤖 AI Chat Store</CardTitle>
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
          <CardTitle className="text-lg">🎮 Interactive Controls</CardTitle>
          <CardDescription>
            Test store actions and see real-time updates
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
                  Auth is now managed by Better Auth. Use the sign-in/sign-out UI instead.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => chat.addMessage({
                    role: 'user',
                    content: 'This is a MobX demo message!',
                  })}
                  size="sm"
                >
                  Add User Message
                </Button>
                <Button 
                  onClick={() => chat.addMessage({
                    role: 'assistant',
                    content: 'This is a demo AI response powered by MobX!',
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
      
      {/* State Inspection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 State Inspection</CardTitle>
          <CardDescription>
            Live view of store states (updates every 2s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth-state">
            <TabsList>
              <TabsTrigger value="auth-state">Auth State</TabsTrigger>
              <TabsTrigger value="chat-state">Chat State</TabsTrigger>
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