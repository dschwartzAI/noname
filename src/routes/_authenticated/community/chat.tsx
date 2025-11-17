"use client"

import { createFileRoute } from '@tanstack/react-router'
import { Chats } from '@/features/chats'

export const Route = createFileRoute('/_authenticated/community/chat')({
  component: CommunityChat
})

function CommunityChat() {
  return <Chats />
}

