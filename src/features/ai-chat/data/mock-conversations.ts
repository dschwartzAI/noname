import type { Conversation, Agent } from '../types'

const agents: Agent[] = [
  {
    id: 'sovereign',
    name: 'SovereignJK',
    avatar: '/avatars/sovereign.png',
    greeting: 'How can I help you build your business today?',
    model: 'gpt-4o',
  },
  {
    id: 'hybrid-offer',
    name: 'Hybrid Offer Agent',
    avatar: '/avatars/hybrid.png',
    greeting: 'Let me help you create an irresistible offer.',
    model: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'dcm',
    name: 'DCM Agent',
    avatar: '/avatars/dcm.png',
    greeting: 'Ready to map out your Dream Client Model?',
    model: 'gpt-4o',
  },
]

export const mockConversations: Conversation[] = [
  // Today
  {
    id: 'conv-1',
    title: 'Three Es Explained',
    agent: agents[0],
    lastMessage: {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'The Three Es framework consists of Educate, Entertain, and Engage...',
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: 'conv-2',
    title: undefined, // Will show first message
    agent: agents[1],
    lastMessage: {
      id: 'msg-2',
      conversationId: 'conv-2',
      role: 'user',
      content: 'Help me create a hybrid offer for my coaching business',
      createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: 'conv-3',
    title: undefined,
    agent: agents[0],
    lastMessage: {
      id: 'msg-3',
      conversationId: 'conv-3',
      role: 'user',
      content: 'What are the best practices for client onboarding?',
      createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5),
  },

  // Yesterday
  {
    id: 'conv-4',
    title: 'Do You Need Assistance Now?',
    agent: agents[2],
    lastMessage: {
      id: 'msg-4',
      conversationId: 'conv-4',
      role: 'assistant',
      content: 'Let me help you identify your ideal client profile...',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 3), // Yesterday, 3 hours
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 4),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 3),
  },
  {
    id: 'conv-5',
    title: 'Business Model And Pricing',
    agent: agents[1],
    lastMessage: {
      id: 'msg-5',
      conversationId: 'conv-5',
      role: 'assistant',
      content: 'Here are three pricing strategies that would work well for your offer...',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 6),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 8),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 60 * 6),
  },

  // Previous 7 days
  {
    id: 'conv-6',
    title: 'Choose Your Offer Type',
    agent: agents[1],
    lastMessage: {
      id: 'msg-6',
      conversationId: 'conv-6',
      role: 'user',
      content: 'Should I do group coaching or 1-on-1?',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: 'conv-7',
    title: 'High-Intent YouTube Leads',
    agent: agents[0],
    lastMessage: {
      id: 'msg-7',
      conversationId: 'conv-7',
      role: 'assistant',
      content: 'YouTube is perfect for attracting high-intent leads. Here is how...',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },

  // Previous 30 days
  {
    id: 'conv-8',
    title: 'Who Writes The Checks?',
    agent: agents[2],
    lastMessage: {
      id: 'msg-8',
      conversationId: 'conv-8',
      role: 'assistant',
      content: 'Understanding who makes the buying decision is crucial...',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
  },
]

export const defaultAgent = agents[0]
