
import { cn } from "@/lib/utils"
import { Check, ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react"
import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ToolInvocationProps {
  toolName: string
  toolCallId: string
  state: string // Allow generic string to handle 'call', 'result', 'input-available' etc.
  args: any
  result?: any
}

export function ToolInvocation({ toolName, toolCallId, state, args, result }: ToolInvocationProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Determine if completed based on result presence or explicit state
  const isCompleted = state === 'result' || !!result
  const isCalling = !isCompleted && (state === 'call' || state === 'input-available' || state === 'call-request')

  // Format tool name for display (e.g. "googleSearch" -> "Google Search")
  const displayName = toolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()

  return (
    <div className="my-2 rounded-md border bg-muted/40 text-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors rounded-t-md">
          <div className={cn("flex items-center gap-2 flex-1", isCalling && "animate-pulse")}>
            {isCalling ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Wrench className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">
              {isCalling ? `Calling ${displayName}...` : `Used ${displayName}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {isCompleted && <Check className="h-3.5 w-3.5" />}
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t px-3 py-2 space-y-2 bg-background/50 rounded-b-md">
            {/* Arguments Section */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Input</div>
              <div className="bg-muted/50 rounded p-2 overflow-x-auto">
                <pre className="text-xs font-mono">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            </div>

            {/* Result Section (only if completed) */}
            {isCompleted && result && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</div>
                <div className="bg-muted/50 rounded p-2 overflow-x-auto">
                  <pre className="text-xs font-mono">
                    {/* Handle string results vs object results */}
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

