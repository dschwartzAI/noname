import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  // Redirect to profile settings as default
  return <Navigate to="/settings/profile" />
}
