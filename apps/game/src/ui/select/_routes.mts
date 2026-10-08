import { route } from '@rooted/router/routes'

/** 2 Quiz + stage ([screens.md](../../../../../docs/design/screens.md#2-quiz--stage)). */
export const SelectRoute = route`/play/`({
	async resolve({ create }) {
		const { Select } = await import('./select.mts')
		return create(Select)
	},
	seo: { title: 'Choose your path' },
})
