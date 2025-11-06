import {
  Plus,
  Search,
  Settings,
  ArrowUpRight,
  Users,
  MessageSquare,
  Command,
  GalleryVerticalEnd,
  AudioWaveform,
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
      name: 'Solo:OS',
      logo: Command,
      plan: 'Professional',
    },
    {
      name: 'Team Workspace',
      logo: GalleryVerticalEnd,
      plan: 'Team',
    },
    {
      name: 'Agency',
      logo: AudioWaveform,
      plan: 'Enterprise',
    },
  ],
  navGroups: [
    {
      title: '',
      items: [
        {
          title: 'New Chat',
          url: '/ai-chat',
          icon: Plus,
        },
        {
          title: 'Search',
          url: '#',
          icon: Search,
        },
        {
          title: 'Admin',
          url: '#',
          icon: Settings,
        },
        {
          title: 'Syndicate',
          url: '#',
          icon: ArrowUpRight,
        },
        {
          title: 'Community',
          url: '/chats',
          icon: Users,
        },
        {
          title: 'Feedback',
          url: '#',
          icon: MessageSquare,
        },
      ],
    },
  ],
}
