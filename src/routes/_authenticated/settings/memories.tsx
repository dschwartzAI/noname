import { createFileRoute } from '@tanstack/react-router'
import { SettingsMemories } from '@/features/settings/memories'

export const Route = createFileRoute('/_authenticated/settings/memories')({
  component: MemoriesPage,
})

function MemoriesPage() {
  return <SettingsMemories />
}
