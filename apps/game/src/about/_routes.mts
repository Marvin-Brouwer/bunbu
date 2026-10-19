import { route } from '@rooted/router/routes'

/**
 * How to play, from the title: a run on video (`e2e/how-to-play-video.spec.mts`), then the rules in
 * a page, written in Markdown and rendered at build time.
 */
export const HowToPlayRoute = route`/how-to-play/`({
	async resolve({ create }) {
		const [{ Page }, source] = await Promise.all([import('./page.mts'), import('./how-to-play.md')])
		return create(Page, {
			source,
			video: {
				src: 'guide/how-to-play.webm',
				poster: 'guide/how-to-play.jpg',
				caption: 'A run on a sample quiz, with every kind of question.',
			},
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
