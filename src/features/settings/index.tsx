import { Outlet } from '@tanstack/react-router'
import { User, Plug, Brain } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Main } from '@/components/layout/main'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings/profile',
    icon: <User size={18} />,
  },
  {
    title: 'Memories',
    href: '/settings/memories',
    icon: <Brain size={18} />,
  },
  {
    title: 'Integrations',
    href: '/settings/integrations',
    icon: <Plug size={18} />,
  },
]

export function Settings() {
  return (
    <Main fixed>
      <div className='space-y-0.5'>
        <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
          Settings
        </h1>
        <p className='text-muted-foreground'>
          Manage your account settings and set e-mail preferences.
        </p>
      </div>
      <Separator className='my-4 lg:my-6' />
      <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
        <aside className='top-0 lg:sticky lg:w-48 flex-shrink-0'>
          <SidebarNav items={sidebarNavItems} />
        </aside>
        <div className='flex flex-1 overflow-y-hidden p-1 pr-8'>
          <Outlet />
        </div>
      </div>
    </Main>
  )
}
