import {
  LayoutDashboard,
  Palette,
  MessagesSquare,
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  Bot,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'Chat',
      items: [
        {
          title: 'Home',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'New Chat',
          url: '/ai-chat',
          icon: Bot,
        },
        {
          title: 'Community Chat',
          url: '/chats',
          icon: MessagesSquare,
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          title: 'Appearance',
          url: '/settings/appearance',
          icon: Palette,
        },
      ],
    },
  ],
}
