/** Settings, from the title: haptics, volume and reading aloud ([6 Pause](../../../../docs/design/screens.md#6-pause)). */

import { component } from '@rooted/components'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { SettingsForm } from '../_shared/menu/settings-form.mts'

export const Settings = component({
	name: 'settings',
	onMount({ append, create }) {
		append(
			create(MenuScreen, {
				title: 'Settings',
				children: create(SettingsForm, {
					running: false,
				}),
			})
		)
	},
})
