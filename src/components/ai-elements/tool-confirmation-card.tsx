/**
 * Tool Confirmation Card
 *
 * Shows a confirmation prompt for tool calls requiring human approval
 * (human-in-the-loop pattern)
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, X } from 'lucide-react'

interface ToolConfirmationCardProps {
  /**
   * Name of the tool being invoked
   */
  toolName: string

  /**
   * Unique ID for this tool call
   */
  toolCallId: string

  /**
   * Input parameters for the tool
   */
  input?: Record<string, any>

  /**
   * Callback when user confirms the tool execution
   */
  onConfirm: (toolCallId: string, result?: any) => void

  /**
   * Callback when user denies the tool execution
   */
  onDeny?: (toolCallId: string) => void
}

export function ToolConfirmationCard({
  toolName,
  toolCallId,
  input,
  onConfirm,
  onDeny
}: ToolConfirmationCardProps) {

  const handleApprove = () => {
    onConfirm(toolCallId, { confirmed: true })
  }

  const handleDeny = () => {
    if (onDeny) {
      onDeny(toolCallId)
    } else {
      // Default denial behavior
      onConfirm(toolCallId, { confirmed: false, denied: true })
    }
  }

  // Format input parameters for display
  const formatInput = (input: Record<string, any>) => {
    return Object.entries(input)
      .map(([key, value]) => {
        // Format value based on type
        let displayValue = value
        if (typeof value === 'object') {
          displayValue = JSON.stringify(value, null, 2)
        } else if (typeof value === 'string' && value.length > 100) {
          displayValue = value.substring(0, 100) + '...'
        }

        return (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{key}:</span>
            <span className="text-sm">{displayValue}</span>
          </div>
        )
      })
  }

  return (
    <Card className="p-4 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              🔔 Tool Confirmation Required
            </h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
              The AI wants to use the <strong>{toolName}</strong> tool.
            </p>
          </div>
        </div>

        {input && Object.keys(input).length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-md bg-white/50 dark:bg-black/20 border border-yellow-500/20">
            <span className="text-xs font-semibold text-yellow-900 dark:text-yellow-100 uppercase tracking-wide">
              Parameters
            </span>
            <div className="flex flex-col gap-2">
              {formatInput(input)}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Button
            onClick={handleApprove}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Approve
          </Button>
          <Button
            onClick={handleDeny}
            size="sm"
            variant="outline"
            className="flex-1 border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X className="w-4 h-4 mr-2" />
            Deny
          </Button>
        </div>
      </div>
    </Card>
  )
}
