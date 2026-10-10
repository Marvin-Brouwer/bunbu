import { route } from '@rooted/router/routes'

/** How to play, from the title: the rules in a page, written in Markdown and rendered at build time. */
export const HowToPlayRoute = route`/how-to-play/`({
	async resolve({ create }) {
		const [{ Page }, source] = await Promise.all([import('./page.mts'), import('./how-to-play.md')])
		return create(Page, {
			source,
		})
	},
	seo: { title: 'How to play' },
})

/** Credits: the lettering, the 3D models and the software the game is made with, with their licenses. */
export const CreditsRoute = route`/credits/`({
	async resolve({ create }) {
		const [{ Page }, source] = await Promise.all([import('./page.mts'), import('./credits.md')])
		return create(Page, {
			source,
		})
	},
	seo: { title: 'Credits' },
})
