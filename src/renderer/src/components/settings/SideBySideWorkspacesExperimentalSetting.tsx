import type { GlobalSettings } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitch } from './SettingsFormControls'
import { getExperimentalSearchEntry } from './experimental-search'

type SideBySideWorkspacesExperimentalSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function SideBySideWorkspacesExperimentalSetting({
  settings,
  updateSettings
}: SideBySideWorkspacesExperimentalSettingProps): React.JSX.Element {
  const sideBySideWorkspacesEnabled = settings.experimentalSideBySideWorkspaces === true

  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.ExperimentalPane.sideBySideWorkspaces.title',
        'Side-by-side workspaces'
      )}
      description={translate(
        'auto.components.settings.ExperimentalPane.sideBySideWorkspaces.description',
        'Show terminals from several projects at once by splitting the main area into per-project panes.'
      )}
      keywords={getExperimentalSearchEntry().sideBySideWorkspaces.keywords}
      className="space-y-3 py-2"
      id="experimental-side-by-side-workspaces"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 shrink space-y-0.5">
          <Label>
            {translate(
              'auto.components.settings.ExperimentalPane.sideBySideWorkspaces.title',
              'Side-by-side workspaces'
            )}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.ExperimentalPane.sideBySideWorkspaces.copy',
              'Open a project to the side from the sidebar to tile its terminals next to the current one. Drag between panes to resize.'
            )}
          </p>
        </div>
        <SettingsSwitch
          checked={sideBySideWorkspacesEnabled}
          ariaLabel={translate(
            'auto.components.settings.ExperimentalPane.sideBySideWorkspaces.toggleLabel',
            'Toggle side-by-side workspaces'
          )}
          onChange={() =>
            updateSettings({
              experimentalSideBySideWorkspaces: !sideBySideWorkspacesEnabled
            })
          }
        />
      </div>
    </SearchableSetting>
  )
}
