import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

function HomePage() {
  // Redirect to chat history as the home page
  return <Navigate to="/chats" />
}
