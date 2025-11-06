/**
 * MobX AI Chat Store
 * 
 * Reactive AI chat state management using MobX
 */

import { makeAutoObservable, runInAction } from 'mobx'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  model?: string
  isStreaming?: boolean
}

export interface ChatSettings {
  selectedModel: string
  temperature: number
  maxTokens: number
  enableFunctionCalling: boolean
  enableArtifacts: boolean
}

export interface WebSocketState {
  isConnected: boolean
  reconnectCount: number
  lastError: string | null
}

class AIChatStore {
  messages: ChatMessage[] = []
  input = ''
  isStreaming = false
  currentStreamingMessage: string = ''
  
  settings: ChatSettings = {
    selectedModel: 'llama-3.1-8b-instruct',
    temperature: 0.7,
    maxTokens: 2000,
    enableFunctionCalling: false,
    enableArtifacts: false,
  }
  
  websocket: WebSocketState = {
    isConnected: false,
    reconnectCount: 0,
    lastError: null,
  }

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  // Message actions
  addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }
    this.messages.push(newMessage)
    return newMessage.id
  }

  updateMessage(id: string, updates: Partial<ChatMessage>) {
    const message = this.messages.find(m => m.id === id)
    if (message) {
      Object.assign(message, updates)
    }
  }

  removeMessage(id: string) {
    this.messages = this.messages.filter(m => m.id !== id)
  }

  clearMessages() {
    this.messages = []
    this.currentStreamingMessage = ''
  }

  // Input actions
  setInput(value: string) {
    this.input = value
  }

  clearInput() {
    this.input = ''
  }

  // Streaming actions
  setStreaming(isStreaming: boolean) {
    this.isStreaming = isStreaming
  }

  appendToStreamingMessage(chunk: string) {
    this.currentStreamingMessage += chunk
  }

  resetStreamingMessage() {
    this.currentStreamingMessage = ''
  }

  // Settings actions
  updateSettings(updates: Partial<ChatSettings>) {
    Object.assign(this.settings, updates)
  }

  setModel(model: string) {
    this.settings.selectedModel = model
  }

  setTemperature(temperature: number) {
    this.settings.temperature = temperature
  }

  setMaxTokens(maxTokens: number) {
    this.settings.maxTokens = maxTokens
  }

  toggleFunctionCalling() {
    this.settings.enableFunctionCalling = !this.settings.enableFunctionCalling
  }

  toggleArtifacts() {
    this.settings.enableArtifacts = !this.settings.enableArtifacts
  }

  // WebSocket actions
  setWebSocketConnected(isConnected: boolean) {
    this.websocket.isConnected = isConnected
  }

  incrementReconnectCount() {
    this.websocket.reconnectCount++
  }

  resetReconnectCount() {
    this.websocket.reconnectCount = 0
  }

  setWebSocketError(error: string | null) {
    this.websocket.lastError = error
  }

  // Async actions
  async sendMessage(content: string) {
    if (!content.trim()) return

    // Add user message
    this.addMessage({
      role: 'user',
      content: content.trim(),
    })

    // Clear input
    this.clearInput()

    // Start streaming
    this.setStreaming(true)
    this.resetStreamingMessage()

    try {
      // Add assistant message placeholder
      const assistantMessageId = this.addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      })

      // TODO: Implement actual streaming logic here
      // This is where you'd connect to your WebSocket or API

      // For now, just simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      runInAction(() => {
        this.updateMessage(assistantMessageId, {
          content: 'This is a placeholder response. Implement streaming logic here.',
          isStreaming: false,
        })
        this.setStreaming(false)
      })
    } catch (error) {
      runInAction(() => {
        this.setStreaming(false)
        this.addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      })
    }
  }

  // Computed values
  get messageCount() {
    return this.messages.length
  }

  get lastMessage() {
    return this.messages[this.messages.length - 1] || null
  }

  get hasMessages() {
    return this.messages.length > 0
  }

  get canSendMessage() {
    return this.input.trim().length > 0 && !this.isStreaming
  }
}

// Create singleton instance
export const aiChatStore = new AIChatStore()

