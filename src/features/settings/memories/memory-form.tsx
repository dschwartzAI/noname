import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Memory } from '@/../database/schema/memories'

const memoryFormSchema = z.object({
  value: z.string().min(1, 'Info is required').max(2000),
  category: z.enum([
    'business_info',
    'target_audience',
    'offers',
    'current_projects',
    'challenges',
    'goals',
    'personal_info',
  ]),
})

type MemoryFormValues = z.infer<typeof memoryFormSchema>

type MemoryFormProps = {
  memory?: Memory | null
  defaultCategory?: string
  onSave: () => void
  onCancel: () => void
}

const categoryLabels: Record<string, string> = {
  business_info: 'Business Information',
  target_audience: 'Target Audience',
  offers: 'Offers & Services',
  current_projects: 'Current Projects',
  challenges: 'Challenges & Pain Points',
  goals: 'Goals & Objectives',
  personal_info: 'Personal Context',
}

export function MemoryForm({ memory, defaultCategory, onSave, onCancel }: MemoryFormProps) {
  const form = useForm<MemoryFormValues>({
    resolver: zodResolver(memoryFormSchema),
    defaultValues: {
      value: memory?.value || '',
      category: (memory?.category || defaultCategory || 'business_info') as any,
    },
  })

  async function onSubmit(data: MemoryFormValues) {
    try {
      // Auto-generate key from category for manual entries
      const key = memory?.key || categoryLabels[data.category] || 'Custom Entry'

      const payload = {
        ...data,
        key,
      }

      if (memory) {
        // Update existing memory
        const response = await fetch(`/api/v1/memories/${memory.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to update memory')
        }

        toast.success('Memory updated')
      } else {
        // Create new memory
        const response = await fetch('/api/v1/memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            source: 'manual',
          }),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to create memory')
        }

        toast.success('Memory created')
      }

      onSave()
    } catch (error) {
      console.error('Failed to save memory:', error)
      toast.error('Failed to save memory')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the category that best fits this memory
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Info</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Health coaching for busy entrepreneurs"
                  className="resize-none"
                  rows={3}
                  maxLength={2000}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value?.length || 0}/2000 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Memory'
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
