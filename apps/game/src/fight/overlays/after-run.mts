/**
 * What both results screens end with: the one thing to do next with Practise mistakes (when there
 * are any) beside it, then Menu, to the title, with Share beside it on a passed quiz. Both leave
 * the run, which they take the place of in history.
 */

import { component } from '@rooted/components'
import { href, type Path } from '@rooted/router'
import { DojoRoute, withMistakes } from '../../dojo/_routes.mts'
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
		const next = create(MenuButton, {
			...options.next,
			kind: 'primary',
		})

		append(
			element('nav', {
				classes: styles.actions,
				children: [
					options.misses === 0
						? next
						: element('div', {
							classes: styles.pair,
							children: [
								next,
								create(MenuButton, {
									label: 'Practise mistakes',
									// The dojo menu with "only my mistakes" ticked, so Practice asks the run's misses.
									action: () => { options.leave(withMistakes(href.for(DojoRoute))) },
								}),
							],
						}),
					element('div', {
						classes: styles.afterRunRow,
						children: [
							create(MenuButton, {
								label: 'Menu',
								action: () => { options.leave(href.path('/')) },
							}),
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
