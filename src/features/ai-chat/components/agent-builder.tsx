import { Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MODELS } from '@/lib/ai-providers'

interface AgentBuilderProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function AgentBuilder({ open, onOpenChange, trigger }: AgentBuilderProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto px-6">
        <SheetHeader className="pb-6">
          <SheetTitle>Agent Builder</SheetTitle>
          <SheetDescription>
            Configure AI tools with custom instructions, models, and capabilities
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Icon Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer transition-colors">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Upload agent icon</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Optional: The name of the agent" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" placeholder="Optional: Describe your Agent here" />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="instructions">Instructions</Label>
              <Button variant="outline" size="sm">
                Variables
              </Button>
            </div>
            <Textarea
              id="instructions"
              placeholder="The system instructions that the agent uses"
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Conversation Starters */}
          <div className="space-y-2">
            <Label>Conversation Starters</Label>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Enter a conversation starter
            </Button>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <Label htmlFor="model">Model *</Label>
            <Select defaultValue={MODELS.CLAUDE_3_5_SONNET}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MODELS.CLAUDE_3_5_SONNET}>
                  Claude 3.5 Sonnet
                </SelectItem>
                <SelectItem value={MODELS.CLAUDE_3_5_HAIKU}>
                  Claude 3.5 Haiku
                </SelectItem>
                <SelectItem value={MODELS.GPT_4O}>GPT-4o</SelectItem>
                <SelectItem value={MODELS.GPT_4O_MINI}>GPT-4o Mini</SelectItem>
                <SelectItem value={MODELS.O1}>o1</SelectItem>
                <SelectItem value={MODELS.O1_MINI}>o1 Mini</SelectItem>
                <SelectItem value={MODELS.GROK_BETA}>Grok Beta</SelectItem>
                <SelectItem value={MODELS.GROK_2_LATEST}>Grok 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button className="w-full" onClick={() => onOpenChange?.(false)}>
              Save Agent
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
