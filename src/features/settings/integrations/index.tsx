import { ContentSection } from '../components/content-section'

export function SettingsIntegrations() {
  return (
    <ContentSection
      title='Integrations'
      desc='Connect third-party services to enhance your experience.'
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          No integrations configured yet
        </div>
      </div>
    </ContentSection>
  )
}
