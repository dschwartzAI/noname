import { useLayout } from '@/context/layout-provider'
import { Sidebar, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { collapsible, variant } = useLayout()
  const { open, setOpen } = useSidebar()

  // Click handler to toggle sidebar (expand when collapsed, collapse when expanded)
  const handleClick = (e: React.MouseEvent) => {
    // Only toggle if click is not on an interactive element
    if (e.target instanceof HTMLElement) {
      const isInteractive = e.target.closest(
        'a, button, [role="button"], [role="menuitem"], [role="dialog"], input, textarea, select'
      )
      if (!isInteractive) {
        setOpen(!open)
      }
    }
  }

  return (
    <Sidebar
      {...props}
      collapsible={collapsible}
      variant={variant}
      onClick={handleClick}
      className={cn(
        // Cursor pointer on hover to indicate clickability
        "cursor-pointer",
        // Subtle hover effect on the sidebar
        "hover:bg-sidebar/95 transition-colors duration-200",
        props.className
      )}
    />
  )
}
