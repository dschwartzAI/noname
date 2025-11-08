"use client"

import { Outlet } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/syndicate')({
  component: SyndicateLayout
})

function SyndicateLayout() {
  return <Outlet />
}
