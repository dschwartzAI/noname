import { createFileRoute, Outlet } from '@tanstack/react-router'

function ChatLayout() {
  // Conversation list is now in the global sidebar (authenticated-layout.tsx)
  // This route just renders the main chat content area
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <Outlet />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat')({
  component: ChatLayout,
})
