/**
 * One of the game's own pages, written in Markdown in this folder and rendered at build time by
 * [`@rooted/markdown`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/markdown.md).
 * The title comes from the file's frontmatter.
 */

import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { href } from '@rooted/router'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import styles from './page.css'

export type PageOptions = {
	/** A `.md` module of this folder. */
	readonly source: {
		readonly frontmatter: Readonly<Record<string, unknown>>
		readonly html: string
	}
}

export const Page = component<PageOptions>({
	name: 'page',
	styles,
	onMount({ append, create, options }) {
		const { title } = options.source.frontmatter as { title: string }

		append(
			create(MenuScreen, {
				title,
				back: href.path('/'),
				children: create(Markdown, {
					source: options.source,
					tag: 'article',
					classes: styles.prose,
				}),
			})
		)
	},
})
