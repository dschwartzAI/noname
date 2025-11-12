import { Plus, Pencil, ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { useAgents, type Agent } from '@/hooks/use-agents'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentIconUpload } from './agent-icon-upload'
import { getAgentIconSrc, getAgentEmoji } from '../utils/get-agent-icon'

// AI Model Options (Updated November 2025)
const MODELS = [
  // OpenAI GPT-5 (Released August 2025)
  { value: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', provider: 'OpenAI' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano', provider: 'OpenAI' },
  { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat (Latest)', provider: 'OpenAI' },

  // OpenAI GPT-4 (Legacy)
  { value: 'gpt-4o', label: 'GPT-4o (Legacy)', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)', provider: 'OpenAI' },

  // Anthropic Claude 4.5 (Released September 2025)
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Sep 2025)', provider: 'Anthropic' },

  // xAI Grok 4 (Released July 2025)
  { value: 'grok-4-latest', label: 'Grok 4 (Latest)', provider: 'xAI' },
  { value: 'grok-4-0709', label: 'Grok 4 (Jul 2025)', provider: 'xAI' },
  { value: 'grok-4-fast-reasoning', label: 'Grok 4 Fast (Reasoning)', provider: 'xAI' },
  { value: 'grok-4-fast-non-reasoning', label: 'Grok 4 Fast (Non-Reasoning)', provider: 'xAI' },
]

interface AgentBuilderProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function AgentBuilder({ open, onOpenChange, trigger, onSuccess }: AgentBuilderProps) {
  const queryClient = useQueryClient()
  const { data: agentsData, isLoading: agentsLoading } = useAgents()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // UI state
  const [view, setView] = useState<'list' | 'form'>('list')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [icon, setIcon] = useState('') // Legacy emoji field
  const [iconUrl, setIconUrl] = useState<string | null>(null) // Uploaded icon URL
  const [model, setModel] = useState('gpt-4o')
  const [artifactsEnabled, setArtifactsEnabled] = useState(true) // Default to enabled
  const [artifactInstructions, setArtifactInstructions] = useState('')

  // Load full agent details when editing (must use GET endpoint, not LIST)
  useEffect(() => {
    if (selectedAgentId) {
      // Fetch full agent details including instructions and avatar
      fetch(`/api/v1/agents/${selectedAgentId}`)
        .then(res => res.json())
        .then(data => {
          if (data.agent) {
            const agent = data.agent
            setName(agent.name)
            setDescription(agent.description || '')
            setInstructions(agent.instructions || '') // ✅ Now loads from GET endpoint
            setIcon(agent.icon || '')
            // Load avatar URL if available
            if (agent.avatar && agent.avatar.source === 'upload') {
              setIconUrl(agent.avatar.value)
            } else {
              setIconUrl(null)
            }
            setModel(agent.model)
            setArtifactsEnabled(agent.artifactsEnabled || false)
            setArtifactInstructions(agent.artifactInstructions || '')
          }
        })
        .catch(err => {
          console.error('Failed to load agent details:', err)
          alert('Failed to load tool details')
        })
    }
  }, [selectedAgentId])

  const handleCreateNew = () => {
    setSelectedAgentId(null)
    setName('')
    setDescription('')
    setInstructions('')
    setIcon('')
    setIconUrl(null)
    setModel('gpt-4o')
    setArtifactsEnabled(true) // Default to enabled for new tools
    setArtifactInstructions('')
    setView('form')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setView('list')
      setSelectedAgentId(null)
    }
    onOpenChange?.(isOpen)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Tool name is required')
      return
    }

    if (!instructions.trim()) {
      alert('Instructions are required')
      return
    }

    try {
      setIsSubmitting(true)

      // Determine if we're creating or updating
      const isEditing = !!selectedAgentId
      const url = isEditing ? `/api/v1/agents/${selectedAgentId}` : '/api/v1/agents'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          instructions,
          icon: icon || undefined,
          avatar: iconUrl ? {
            source: 'upload',
            value: iconUrl,
          } : (icon ? {
            source: 'emoji',
            value: icon,
          } : undefined),
          provider: MODELS.find(m => m.value === model)?.provider.toLowerCase() || 'openai',
          model,
          artifactsEnabled,
          artifactInstructions: artifactsEnabled ? artifactInstructions : undefined,
          published: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'create'} agent`)
      }

      const result = await response.json()
      console.log(`✅ Tool ${isEditing ? 'updated' : 'created'} successfully:`, result)

      // Invalidate query to refresh list
      queryClient.invalidateQueries({ queryKey: ['agents'] })

      // Reset form
      setName('')
      setDescription('')
      setInstructions('')
      setIcon('')
      setIconUrl(null)
      setModel('gpt-4o')
      setArtifactsEnabled(false)
      setArtifactInstructions('')
      setSelectedAgentId(null)

      // Return to list
      setView('list')

      onSuccess?.()

      alert(`Tool "${name}" ${isEditing ? 'updated' : 'created'} successfully`)

    } catch (error) {
      console.error(`❌ Agent ${selectedAgentId ? 'update' : 'creation'} failed:`, error)
      alert(error instanceof Error ? error.message : 'Failed to save tool')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return

    try {
      const response = await fetch(`/api/v1/agents/${agentToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete tool')
      }

      console.log(`✅ Tool "${agentToDelete.name}" deleted successfully`)

      // Invalidate query to refresh list
      queryClient.invalidateQueries({ queryKey: ['agents'] })

      // Close dialog and return to list
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
      setView('list')
      setSelectedAgentId(null)

      alert(`Tool "${agentToDelete.name}" deleted successfully`)

    } catch (error) {
      console.error('❌ Delete failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tool')
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto px-6">
        <SheetHeader className="pb-6">
          <SheetTitle>
            {view === 'list' ? 'Tools' : selectedAgentId ? 'Edit Tool' : 'Create Tool'}
          </SheetTitle>
          <SheetDescription>
            {view === 'list'
              ? 'Select a tool to edit or create a new one'
              : 'Configure AI tools with custom instructions, models, and capabilities'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {view === 'list' ? (
            // === LIST VIEW ===
            <>
              <Button onClick={handleCreateNew} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Tool
              </Button>

              {agentsLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}

              {agentsData && agentsData.agents.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tools yet. Create your first tool above.
                </div>
              )}

              {agentsData && agentsData.agents.length > 0 && (
                <div className="space-y-2">
                  {agentsData.agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id)
                        setView('form')
                      }}
                      className="w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {getAgentIconSrc(agent) ? (
                            <img
                              src={getAgentIconSrc(agent)!}
                              alt={agent.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{getAgentEmoji(agent) || '🤖'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{agent.name}</div>
                          {agent.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {agent.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {agent.model}
                          </div>
                        </div>
                        <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // === FORM VIEW ===
            <>
              {/* Back Button */}
              <Button
                variant="ghost"
                onClick={() => setView('list')}
                className="w-full justify-start -mt-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tools
              </Button>

              {/* Icon */}
              <div className="space-y-2">
                <Label>Icon</Label>
                <AgentIconUpload
                  currentIcon={iconUrl}
                  currentEmoji={icon}
                  onUploadComplete={(url) => {
                    setIconUrl(url)
                    setIcon('') // Clear emoji when uploading custom icon
                  }}
                  onRemove={() => setIconUrl(null)}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Hybrid Offer Architect"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional: Describe your tool here"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions *</Label>
                <Textarea
                  id="instructions"
                  placeholder="The system instructions that the tool uses"
                  className="min-h-[120px] resize-none"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  required
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex flex-col">
                          <span>{m.label}</span>
                          <span className="text-xs text-muted-foreground">{m.provider}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Artifacts Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="artifacts-enabled">Enable Artifacts</Label>
                  <Switch
                    id="artifacts-enabled"
                    checked={artifactsEnabled}
                    onCheckedChange={setArtifactsEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Allow this tool to generate code artifacts, documents, charts, and interactive components
                </p>
              </div>

              {/* Artifact Instructions (conditional) */}
              {artifactsEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="artifact-instructions">Artifact Instructions</Label>
                  <Textarea
                    id="artifact-instructions"
                    placeholder="Instructions for how the AI should generate artifacts (e.g., 'Create interactive React components with TypeScript and Tailwind CSS')"
                    className="min-h-[100px] resize-none"
                    value={artifactInstructions}
                    onChange={(e) => setArtifactInstructions(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Specific guidance for artifact generation and formatting
                  </p>
                </div>
              )}

              {/* Submit */}
              <div className="pt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : selectedAgentId ? 'Update Tool' : 'Create Tool'}
                </Button>

                {/* Delete Button (only show when editing) */}
                {selectedAgentId && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      const agentName = name || 'this tool'
                      setAgentToDelete({ id: selectedAgentId, name: agentName })
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Tool
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
