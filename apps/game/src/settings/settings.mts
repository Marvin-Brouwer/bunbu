/** Settings, from the title: difficulty, haptics and volume ([6 Pause](../../../../docs/design/screens.md#6-pause)). */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { SettingsForm } from '../_shared/menu/settings-form.mts'

export const Settings = component({
	name: 'settings',
	onMount({ append, create }) {
		append(
			create(MenuScreen, {
				title: 'Settings',
				back: href.path('/'),
				children: create(SettingsForm, {
					running: false,
				}),
			})
		)
	},
})
