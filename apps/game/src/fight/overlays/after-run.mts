/**
 * What both results screens end with: the one thing to do next, then Practise mistakes (when there
 * are any) and Menu.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { DojoRoute } from '../../dojo/_routes.mts'
import { MenuButton, type MenuButtonOptions } from '../../_shared/menu/menu-button.mts'
import styles from './overlays.css'

export type AfterRunOptions = {
	/** Next stage, or Rise again. */
	readonly next: MenuButtonOptions
	readonly misses: number
}

export const AfterRun = component<AfterRunOptions>({
	name: 'after-run',
	styles,
	onMount({ append, create, element, options }) {
		const menu = create(MenuButton, {
			label: 'Menu',
			href: href.path('/'),
		})

		append(
			element('nav', {
				classes: styles.actions,
				children: [
					create(MenuButton, {
						...options.next,
						kind: 'primary',
					}),
					options.misses === 0
						? menu
						: element('div', {
							classes: styles.pair,
							children: [
								create(MenuButton, {
									label: 'Practise mistakes',
									href: href.for(DojoRoute),
								}),
								menu,
							],
						}),
				],
			})
		)
	},
})
