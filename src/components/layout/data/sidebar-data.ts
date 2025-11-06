import {
  Plus,
  Search,
  ArrowUpRight,
  Users,
  MessageSquare,
  Command,
  GalleryVerticalEnd,
  AudioWaveform,
  Shield,
  Building2,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
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
          title: 'God Mode',
          url: '/admin/god-dashboard',
          icon: Shield,
        },
        {
          title: 'Admin',
          url: '/admin',
          icon: Building2,
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
