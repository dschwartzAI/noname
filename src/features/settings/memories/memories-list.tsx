import { useState, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MemoryCard } from './memory-card'
import { MemoryForm } from './memory-form'
import type { Memory } from '@/../database/schema/memories'

type MemoryCategory = 'business_info' | 'target_audience' | 'offers' | 'current_projects' | 'challenges' | 'goals' | 'personal_info'

const categories: Array<{ value: MemoryCategory; label: string }> = [
  { value: 'business_info', label: 'Business Info' },
  { value: 'target_audience', label: 'Target Audience' },
  { value: 'offers', label: 'Offers & Services' },
  { value: 'current_projects', label: 'Current Projects' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'goals', label: 'Goals' },
  { value: 'personal_info', label: 'Personal Info' },
]

export function MemoriesList() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory>('business_info')
  const [isCreating, setIsCreating] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)

  const loadMemories = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/memories', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load memories')
      }

      const data = await response.json()
      setMemories(data.memories || [])
    } catch (error) {
      console.error('Failed to load memories:', error)
      toast.error('Failed to load memories')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMemories()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/memories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete memory')
      }

      toast.success('Memory deleted')
      await loadMemories()
    } catch (error) {
      console.error('Failed to delete memory:', error)
      toast.error('Failed to delete memory')
    }
  }

  const handleSave = async () => {
    setIsCreating(false)
    setEditingMemory(null)
    await loadMemories()
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingMemory(null)
  }

  const filteredMemories = memories.filter(m => m.category === selectedCategory)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the information AI remembers about your business and context
        </p>
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isCreating || editingMemory !== null}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Memory
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingMemory) && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h3 className="font-medium mb-4">
            {editingMemory ? 'Edit Memory' : 'Create Memory'}
          </h3>
          <MemoryForm
            memory={editingMemory}
            defaultCategory={isCreating ? selectedCategory : undefined}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as MemoryCategory)}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            {categories.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="text-xs whitespace-nowrap">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {categories.map(cat => (
          <TabsContent key={cat.value} value={cat.value} className="space-y-4 mt-6">
            {filteredMemories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No {cat.label.toLowerCase()} memories yet</p>
                <p className="text-sm mt-1">
                  Memories will be automatically learned from conversations, or you can add them manually
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMemories.map(memory => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onEdit={() => setEditingMemory(memory)}
                    onDelete={() => handleDelete(memory.id)}
                    disabled={isCreating || editingMemory !== null}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
