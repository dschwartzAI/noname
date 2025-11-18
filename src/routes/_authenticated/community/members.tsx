"use client"

import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/community/members')({
  component: MembersPage
})

function MembersPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Users className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-semibold mb-2">Members Directory</h2>
            <p className="text-muted-foreground">
              Community members directory coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

