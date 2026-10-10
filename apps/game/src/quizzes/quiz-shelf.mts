/**
 * The area to drop or choose a quiz file, then why the last file didn't load and what won't fit in
 * a fight of the chosen quiz, then the loaded quizzes as cards, one to choose.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { library, type LibraryState } from '../_shared/storage/library.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { fixtureQuiz } from '../_temp/quiz.mts'
import { LoadQuiz } from './load-quiz.mts'
import { QuizCard } from './quiz-card.mts'
import { FitNotice, LoadProblems } from '../_shared/quiz/quiz-notices.mts'
import { fitNotesOf, type ReadQuiz } from '../_shared/quiz/read-quiz.mts'
import styles from './quiz-shelf.css'

const same = (quiz: BunbuData, other: BunbuData | undefined) => quiz.id === other?.id && quiz.version === other.version

/** The quizzes to choose from: the library, and in dev the fixture quiz when the library doesn't have it. */
function quizzesIn(state: LibraryState): BunbuData[] {
	const quizzes = state.entries.map((entry) => entry.quiz)
	if (import.meta.env.DEV && !quizzes.some((quiz) => same(quiz, fixtureQuiz))) quizzes.push(fixtureQuiz)
	return quizzes
}

export const QuizShelf = component({
	name: 'quiz-shelf',
	styles,
	onMount({ append, create, element, signal }) {
		const shelf = element('div', {
			classes: styles.shelf,
			role: 'radiogroup',
			aria: {
				label: 'Quiz',
			},
		})
		const notices = element('div', {
			classes: styles.notices,
		})

		let failed: { readonly file: string, readonly problems: readonly string[] } | undefined

		const read = (file: File, result: ReadQuiz) => {
			if ('problems' in result) {
				failed = { file: file.name, problems: result.problems }
				showNotices()
				return
			}
			failed = undefined
			// Chosen first, so the new card comes in checked.
			selection.value.chooseQuiz(result.quiz)
			library.value.add(result)
		}

		append(
			create(LoadQuiz, {
				read,
			}),
			notices,
			shelf,
		)

		// Only a change of the library refills the list: choosing a card checks its radio already.
		const showShelf = (state: LibraryState) => {
			const { quiz: chosen } = snapshot<SelectionState>(selection)
			shelf.replaceChildren(
				...quizzesIn(state).map((quiz) => create(QuizCard, {
					quiz,
					chosen: same(quiz, chosen),
					choose: () => { selection.value.chooseQuiz(quiz) },
				})),
			)
		}

		const showNotices = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			notices.replaceChildren(
				...failed === undefined
					? []
					: [create(LoadProblems, failed)],
				...quiz === undefined
					? []
					: [create(FitNotice, { notes: fitNotesOf(quiz) })],
			)
		}

		showShelf(snapshot<LibraryState>(library))
		showNotices()
		library.on('change', signal, () => {
			showShelf(snapshot<LibraryState>(library))
		})
		selection.on('change', signal, () => {
			showNotices()
		})
	},
})
