"use client"

import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/syndicate/')({
  component: SyndicateRedirect
})

function SyndicateRedirect() {
  // Redirect directly to classroom
  return <Navigate to="/syndicate/classroom" replace />
}
