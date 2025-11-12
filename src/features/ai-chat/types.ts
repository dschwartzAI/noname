export interface Agent {
  id: string
  name: string
  avatar?: {
    source: 'emoji' | 'url' | 'upload'
    value: string
  } | null
  icon?: string | null
  greeting: string
  model?: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}

export interface Conversation {
  id: string
  title?: string
  agent: Agent
  lastMessage?: Message
  createdAt: Date
  updatedAt: Date
  messages?: Message[]
}
