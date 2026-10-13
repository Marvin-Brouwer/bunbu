/**
 * What both results screens end with: the one thing to do next, then Practise mistakes (when there
 * are any) and Menu, to the title, with Share beside them on a passed quiz. Both leave the run,
 * which they take the place of in history.
 */

import { component } from '@rooted/components'
import { href, type Path } from '@rooted/router'
import { DojoRoute } from '../../dojo/_routes.mts'
import { MenuButton, type MenuButtonOptions } from '../../_shared/menu/menu-button.mts'
import { ShareScoreButton, type ShareScoreButtonOptions } from './share-score-button.mts'
import styles from './overlays.css'

export type AfterRunOptions = {
	/** Next stage, or Rise again. */
	readonly next: MenuButtonOptions
	readonly misses: number
	readonly leave: (to: Path) => void
	/** The score to share, on a passed quiz. */
	readonly share?: ShareScoreButtonOptions
}

export const AfterRun = component<AfterRunOptions>({
	name: 'after-run',
	styles,
	onMount({ append, create, element, options }) {
		const menu = create(MenuButton, {
			label: 'Menu',
			action: () => { options.leave(href.path('/')) },
		})

		append(
			element('nav', {
				classes: styles.actions,
				children: [
					create(MenuButton, {
						...options.next,
						kind: 'primary',
					}),
					element('div', {
						classes: styles.leaving,
						children: [
							options.misses === 0
								? undefined
								: create(MenuButton, {
									label: 'Practise mistakes',
									action: () => { options.leave(href.for(DojoRoute)) },
								}),
							menu,
							options.share === undefined
								? undefined
								: create(ShareScoreButton, options.share),
						],
					}),
				],
			})
		)
	},
})
