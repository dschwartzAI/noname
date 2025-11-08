import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ContentSection } from '../components/content-section'
import { ProfileForm, ProfileFormSubmitButton } from './profile-form'

const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export function SettingsProfile() {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      bio: '',
      location: '',
      jobTitle: '',
      company: '',
    },
  })

  return (
    <ContentSection
      title='Profile'
      desc='Manage your account settings and personal information.'
      headerAction={<ProfileFormSubmitButton isSubmitting={form.formState.isSubmitting} />}
    >
      <ProfileForm form={form} />
    </ContentSection>
  )
}
