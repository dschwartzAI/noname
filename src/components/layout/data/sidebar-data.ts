import {
  SquarePen,
  Search,
  ArrowUpRight,
  Users,
  MessageSquare,
  Command,
  Shield,
  Building2,
  GraduationCap,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'SoloOS',
      logo: Command,
      plan: 'Professional',
    },
  ],
  navGroups: [
    {
      title: '',
      items: [
        {
          title: 'Tools',
          url: '/ai-chat',
          icon: SquarePen,
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
          url: '/syndicate',
          icon: GraduationCap,
        },
        {
          title: 'Community',
          url: '/community',
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
