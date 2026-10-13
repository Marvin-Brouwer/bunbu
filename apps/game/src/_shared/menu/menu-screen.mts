/**
 * A menu screen on papyrus: a back link and a heading, then the screen's own parts. It scrolls as a
 * whole when it is taller than the phone.
 *
 * With a `dock`, the dock stays at the bottom of the screen instead, and the parts fill the room
 * between the heading and the dock in a column: the screen doesn't scroll, so a part that can grow
 * scrolls on its own, as the study's text.
 */

import { component, optional } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import type { Path } from '@rooted/router'
import { BackLink } from './back-link.mts'
import styles from './menu.css'

export type MenuScreenOptions = {
	readonly title: string
	/** Where the back link goes: back through the history when the player came from there. */
	readonly back: Path
	/** Back to whichever page came before instead, as the browser's Back; `back` only when there is none. */
	readonly stepBack?: boolean
	readonly children: ElementChildren
	/** At the right of the heading, as a settings button. */
	readonly action?: ElementChildren
	/** Docked at the bottom of the screen, as the controls of the dojo's study. */
	readonly dock?: ElementChildren
}

export const MenuScreen = component<MenuScreenOptions>({
	name: 'menu-screen',
	styles,
	onMount({ append, create, element, options }) {
		const { action, dock } = options
		const parts = [options.children].flat()

		append(
			element('section', {
				classes: styles.screen,
				'data-docked': String(dock !== undefined),
				children: element('div', {
					classes: styles.page,
					children: [
						element('header', {
							classes: styles.header,
							children: [
								create(BackLink, {
									target: options.back,
									stepBack: options.stepBack,
								}),
								element('h1', {
									classes: styles.title,
									textContent: options.title,
								}),
								optional(action !== undefined,
									element('div', {
										classes: styles.action,
										children: action,
									})
								),
							],
						}),
						...dock === undefined
							? parts
							: [
								element('div', {
									classes: styles.parts,
									children: parts,
								}),
								element('div', {
									classes: styles.dock,
									children: dock,
								}),
							],
					],
				}),
			})
		)
	},
})
