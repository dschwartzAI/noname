"use client"

import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/community/')({
  component: CommunityIndex
})

function CommunityIndex() {
  // Redirect to feed as the default view
  return <Navigate to="/community/feed" replace />
}
