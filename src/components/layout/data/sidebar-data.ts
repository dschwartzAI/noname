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
  LayoutDashboard,
  UsersRound,
  Database,
  Settings,
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
          icon: Building2,
          items: [
            {
              title: 'Dashboard',
              url: '/admin',
              icon: LayoutDashboard,
            },
            {
              title: 'Users',
              url: '/admin/users',
              icon: UsersRound,
            },
            {
              title: 'Knowledge',
              url: '/admin/knowledge',
              icon: Database,
            },
            {
              title: 'Settings',
              url: '/admin/settings',
              icon: Settings,
            },
          ],
        },
        {
          title: 'Classroom',
          url: '/syndicate/classroom',
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
