/**
 * One of the game's own pages, written in Markdown in this folder and rendered at build time by
 * [`@rooted/markdown`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/markdown.md).
 * The title comes from the file's frontmatter. A link to another page of the game opens it in place,
 * like a `Link` does.
 */

import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { navigate } from '@rooted/router'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import styles from './page.css'

export type PageOptions = {
	/** A `.md` module of this folder. */
	readonly source: {
		readonly frontmatter: Readonly<Record<string, unknown>>
		readonly html: string
	}
	/** A video above the text, in `public/`: its file, a still to show until it plays, and what it shows. */
	readonly video?: {
		readonly src: string
		readonly poster: string
		readonly caption: string
	}
}

export const Page = component<PageOptions>({
	name: 'page',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { title } = options.source.frontmatter as { title: string }
		const { video } = options

		const prose = create(Markdown, {
			source: options.source,
			tag: 'article',
			classes: styles.prose,
		})
		prose.addEventListener('click', (event) => {
			const link = (event.target as Element).closest('a')
			if (link?.origin !== location.origin) return
			event.preventDefault()
			navigate(link.href)
		}, { signal })

		append(
			create(MenuScreen, {
				title,
				children: [
					video === undefined
						? undefined
						: element('figure', {
							classes: styles.video,
							children: [
								element('video', {
									src: `${import.meta.env.BASE_URL}${video.src}`,
									poster: `${import.meta.env.BASE_URL}${video.poster}`,
									controls: true,
									muted: true,
									playsInline: true,
									preload: 'none',
								}),
								element('figcaption', {
									textContent: video.caption,
								}),
							],
						}),
					prose,
				],
			})
		)
	},
})
