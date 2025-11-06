import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Agent } from '../types'

interface AgentHeaderProps {
  agent: Agent
}

export function AgentHeader({ agent }: AgentHeaderProps) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-3 p-8 border-b">
      <Avatar className="h-16 w-16">
        <AvatarImage src={agent.avatar} />
        <AvatarFallback className="text-2xl">{agent.name[0]}</AvatarFallback>
      </Avatar>
      <div className="text-center">
        <h2 className="text-xl font-semibold">{agent.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{agent.greeting}</p>
      </div>
    </div>
  )
}
