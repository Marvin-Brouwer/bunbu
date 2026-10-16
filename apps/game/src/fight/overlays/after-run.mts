/**
 * What both results screens end with: the one thing to do next with Practise mistakes (when there
 * are any) beside it, then Menu, to the title, with Share beside it on a passed quiz. Both leave
 * the run, which they take the place of in history.
 */

import { component } from '@rooted/components'
import { href, type Path } from '@rooted/router'
import { PracticeMistakesRoute } from '../../dojo/_routes.mts'
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
	/** A line above the buttons on why the next thing to do is what it is, as why it is Retry. */
	readonly hint?: string
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
					options.hint === undefined
						? undefined
						: element('p', {
							classes: styles.actionsHint,
							textContent: options.hint,
						}),
					options.misses === 0
						? next
						: element('div', {
							classes: styles.pair,
							children: [
								next,
								create(MenuButton, {
									label: 'Practise mistakes',
									// Practice on the run's misses.
									action: () => { options.leave(href.for(PracticeMistakesRoute)) },
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
