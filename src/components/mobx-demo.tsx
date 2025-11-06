/**
 * MobX Demo Component
 * 
 * Demonstrates using MobX for state management with React
 */

import { observer } from 'mobx-react-lite'
import { useAuthMobx } from '@/hooks/use-auth-mobx'
import { useAIChatMobx } from '@/hooks/use-ai-chat-mobx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

// This component must be wrapped with observer() to react to MobX state changes
export const MobXDemo = observer(() => {
  const auth = useAuthMobx()
  const chat = useAIChatMobx()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">MobX State Management Demo</h1>
        <p className="text-muted-foreground">
          Reactive state management using MobX with automatic component updates
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Auth Store Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Auth Store (MobX)</CardTitle>
            <CardDescription>
              Current authentication state managed by MobX
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={auth.isAuthenticated ? 'default' : 'secondary'}>
                  {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </Badge>
              </div>

              {auth.isAuthenticated && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Email:</span>
                    <span className="text-sm text-muted-foreground">
                      {auth.userEmail}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Name:</span>
                    <span className="text-sm text-muted-foreground">
                      {auth.userName}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Loading:</span>
                <Badge variant="outline">{auth.isLoading ? 'Yes' : 'No'}</Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Actions:</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => auth.refreshSession()}
                  disabled={auth.isLoading}
                >
                  Refresh Session
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => auth.clearError()}
                  disabled={!auth.error}
                >
                  Clear Error
                </Button>
                {auth.isAuthenticated && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => auth.signOut()}
                    disabled={auth.isLoading}
                    className="col-span-2"
                  >
                    Sign Out
                  </Button>
                )}
              </div>
            </div>

            {auth.error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{auth.error.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Chat Store Demo */}
        <Card>
          <CardHeader>
            <CardTitle>AI Chat Store (MobX)</CardTitle>
            <CardDescription>
              Chat state with reactive updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Messages:</span>
                <Badge variant="secondary">{chat.messageCount}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Streaming:</span>
                <Badge variant={chat.isStreaming ? 'default' : 'outline'}>
                  {chat.isStreaming ? 'Active' : 'Idle'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Model:</span>
                <span className="text-sm text-muted-foreground">
                  {chat.settings.selectedModel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">WebSocket:</span>
                <Badge variant={chat.websocket.isConnected ? 'default' : 'secondary'}>
                  {chat.websocket.isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Send Test Message:</h4>
              <Input
                placeholder="Type a message..."
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (chat.canSendMessage) {
                      chat.sendMessage(chat.input)
                    }
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => chat.sendMessage(chat.input)}
                  disabled={!chat.canSendMessage}
                >
                  Send Message
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => chat.clearMessages()}
                  disabled={!chat.hasMessages}
                >
                  Clear Messages
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Settings:</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => chat.toggleFunctionCalling()}
                >
                  Function Calling: {chat.settings.enableFunctionCalling ? 'On' : 'Off'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => chat.toggleArtifacts()}
                >
                  Artifacts: {chat.settings.enableArtifacts ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message History */}
      {chat.hasMessages && (
        <Card>
          <CardHeader>
            <CardTitle>Message History</CardTitle>
            <CardDescription>
              Recent messages (automatically updates with MobX)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {chat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary/10 ml-8'
                      : 'bg-muted mr-8'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                      {message.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MobX Info */}
      <Card>
        <CardHeader>
          <CardTitle>About MobX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p>
              <strong>MobX</strong> is a battle-tested library that makes state management
              simple and scalable through transparent functional reactive programming (TFRP).
            </p>
            
            <h4 className="font-semibold mt-4">Key Features:</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Automatic tracking of dependencies</li>
              <li>Minimal boilerplate with <code>makeAutoObservable()</code></li>
              <li>Excellent TypeScript support</li>
              <li>Small bundle size (~16KB)</li>
              <li>Works with React via <code>observer()</code> HOC</li>
              <li>Computed values are memoized automatically</li>
            </ul>

            <h4 className="font-semibold mt-4">Usage in this demo:</h4>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Stores are created as classes with <code>makeAutoObservable()</code></li>
              <li>Components use <code>observer()</code> to react to state changes</li>
              <li>Custom hooks provide clean API for accessing stores</li>
              <li>Async actions use <code>runInAction()</code> for state updates</li>
            </ol>
          </div>

          <Separator />

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-mono">
              💡 Try interacting with the stores above to see MobX in action!
              All updates happen automatically without manual subscriptions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

