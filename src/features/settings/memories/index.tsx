import { ContentSection } from '../components/content-section'
import { MemoriesList } from './memories-list'

export function SettingsMemories() {
  return (
    <ContentSection
      title='Memories'
      desc='View and manage the information AI remembers about your business context.'
    >
      <MemoriesList />
    </ContentSection>
  )
}
