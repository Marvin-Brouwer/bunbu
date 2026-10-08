/** 2 Quiz + stage ([screens.md](../../../../docs/design/screens.md#2-quiz--stage)). */

import { component } from '@rooted/components'
import { fixtureQuiz } from '../_temp/quiz.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { selection } from '../_shared/state/selection.mts'

export type SelectOptions = {
	/** Starts a run on the chosen quiz and stage. */
	readonly start: () => void
}

export const Select = component<SelectOptions>({
	name: 'select',
	onMount({ append, create, options }) {
		// In dev a run can start without loading a quiz first, on the fixture quiz.
		if (import.meta.env.DEV && selection.value.quiz === undefined) selection.value.chooseQuiz(fixtureQuiz)

		append(
			create(Placeholder, {
				title: 'Choose your path',
				note: 'Quiz cards, Load .yaml, the five stages and Novice / Adept / Master go here.',
				links: [
					{ label: 'Start run', action: options.start, disabled: selection.value.quiz === undefined },
					{ label: 'Back', href: '/' },
				],
			})
		)
	},
})
