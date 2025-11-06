import { differenceInDays, startOfToday, startOfYesterday } from 'date-fns'
import type { Conversation } from '../types'

export function groupConversationsByTime(conversations: Conversation[]) {
  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    'Previous 30 days': [],
    Older: [],
  }

  const today = startOfToday()
  const yesterday = startOfYesterday()

  // Sort conversations by updatedAt (most recent first)
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  sorted.forEach((convo) => {
    const daysAgo = differenceInDays(today, new Date(convo.updatedAt))

    if (daysAgo === 0) {
      groups.Today.push(convo)
    } else if (daysAgo === 1) {
      groups.Yesterday.push(convo)
    } else if (daysAgo <= 7) {
      groups['Previous 7 days'].push(convo)
    } else if (daysAgo <= 30) {
      groups['Previous 30 days'].push(convo)
    } else {
      groups.Older.push(convo)
    }
  })

  // Remove empty groups and return
  return Object.fromEntries(Object.entries(groups).filter(([_, convos]) => convos.length > 0))
}
