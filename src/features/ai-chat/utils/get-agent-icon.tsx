import type { Agent } from '@/hooks/use-agents';

/**
 * Gets the display icon for an agent
 * Prioritizes uploaded icons over emojis
 */
export function getAgentIconSrc(agent: Agent | { avatar?: { source: string; value: string } | null; icon?: string | null }): string | null {
  // Prefer uploaded avatar
  if (agent.avatar?.source === 'upload' && agent.avatar.value) {
    return agent.avatar.value;
  }

  // Fallback to emoji or null
  return null;
}

/**
 * Gets the emoji for an agent (if using emoji, not upload)
 */
export function getAgentEmoji(agent: Agent | { avatar?: { source: string; value: string } | null; icon?: string | null }): string | null {
  // If using emoji avatar
  if (agent.avatar?.source === 'emoji' && agent.avatar.value) {
    return agent.avatar.value;
  }

  // Legacy icon field
  if (agent.icon) {
    return agent.icon;
  }

  return null;
}

/**
 * Component wrapper for agent icon - handles both image and emoji
 */
interface AgentIconProps {
  agent: Agent | { avatar?: { source: string; value: string } | null; icon?: string | null; name?: string };
  className?: string;
  fallback?: React.ReactNode;
}

export function AgentIcon({ agent, className = "h-6 w-6", fallback = '🤖' }: AgentIconProps) {
  const iconSrc = getAgentIconSrc(agent);
  const emoji = getAgentEmoji(agent);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={('name' in agent && agent.name) || 'Agent icon'}
        className={className}
      />
    );
  }

  if (emoji) {
    return <span className={className}>{emoji}</span>;
  }

  return <span className={className}>{fallback}</span>;
}
