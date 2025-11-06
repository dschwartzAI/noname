/**
 * React Hook for MobX AI Chat Store
 * 
 * Provides reactive access to AI chat state
 */

import { observer } from 'mobx-react-lite'
import { aiChatStore } from '@/stores/ai-chat-mobx'

export function useAIChatMobx() {
  return {
    // State
    messages: aiChatStore.messages,
    input: aiChatStore.input,
    isStreaming: aiChatStore.isStreaming,
    currentStreamingMessage: aiChatStore.currentStreamingMessage,
    settings: aiChatStore.settings,
    websocket: aiChatStore.websocket,
    
    // Computed
    messageCount: aiChatStore.messageCount,
    lastMessage: aiChatStore.lastMessage,
    hasMessages: aiChatStore.hasMessages,
    canSendMessage: aiChatStore.canSendMessage,
    
    // Actions
    addMessage: aiChatStore.addMessage,
    updateMessage: aiChatStore.updateMessage,
    removeMessage: aiChatStore.removeMessage,
    clearMessages: aiChatStore.clearMessages,
    setInput: aiChatStore.setInput,
    clearInput: aiChatStore.clearInput,
    setStreaming: aiChatStore.setStreaming,
    appendToStreamingMessage: aiChatStore.appendToStreamingMessage,
    resetStreamingMessage: aiChatStore.resetStreamingMessage,
    updateSettings: aiChatStore.updateSettings,
    setModel: aiChatStore.setModel,
    setTemperature: aiChatStore.setTemperature,
    setMaxTokens: aiChatStore.setMaxTokens,
    toggleFunctionCalling: aiChatStore.toggleFunctionCalling,
    toggleArtifacts: aiChatStore.toggleArtifacts,
    setWebSocketConnected: aiChatStore.setWebSocketConnected,
    incrementReconnectCount: aiChatStore.incrementReconnectCount,
    resetReconnectCount: aiChatStore.resetReconnectCount,
    setWebSocketError: aiChatStore.setWebSocketError,
    sendMessage: aiChatStore.sendMessage,
  }
}

export { observer }

