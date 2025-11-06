import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/god/')({
  component: GodRedirect,
})

function GodRedirect() {
  // Redirect to the main god dashboard
  return <Navigate to="/admin/god-dashboard" />
}
