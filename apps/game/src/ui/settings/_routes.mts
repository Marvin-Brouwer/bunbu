import { route } from '@rooted/router/routes'

/** Settings: difficulty, haptics, volume ([screens.md](../../../../../docs/design/screens.md#6-pause)). */
export const SettingsRoute = route`/settings/`({
	async resolve({ create }) {
		const { Settings } = await import('./settings.mts')
		return create(Settings)
	},
	seo: { title: 'Settings' },
})
