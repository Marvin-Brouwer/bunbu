/**
 * The button and area to load a quiz file, then why the last file didn't load or which questions it
 * repeated, and what won't fit in a fight of the chosen quiz, then the loaded quizzes as cards, one to choose.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { library, type LibraryEntry, type LibraryState } from '../_shared/storage/library.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { sampleQuizzes } from '../_temp/sample-quizzes.mts'
import { LoadQuiz } from './load-quiz.mts'
import { QuizCard } from './quiz-card.mts'
import { DuplicatesNotice, FitNotice, LoadProblems } from '../_shared/quiz/quiz-notices.mts'
import { fitNotesOf, type ReadQuiz, type RepeatedQuestion } from '../_shared/quiz/read-quiz.mts'
import styles from './quiz-shelf.css'

const same = (quiz: BunbuData, other: BunbuData | undefined) => quiz.id === other?.id && quiz.version === other.version

/**
 * The quizzes to choose from: the library, and in dev the `samples` (the fixture quiz and those in
 * `docs/testdata/`) that the library doesn't have. Only those in the library can be removed; a
 * sample joins it when it is chosen.
 */
function quizzesIn(state: LibraryState, samples: readonly LibraryEntry[]): { entry: LibraryEntry, kept: boolean }[] {
	const kept = state.entries.map((entry) => ({ entry, kept: true }))
	const extra = samples.filter((sample) => !state.entries.some(({ quiz }) => same(quiz, sample.quiz)))
	return [...kept, ...extra.map((entry) => ({ entry, kept: false }))]
}

/** Takes a quiz out of the library, and unchooses it when it was chosen. Its high score stays. */
function remove(quiz: BunbuData): void {
	selection.value.forgetQuiz(quiz.id, quiz.version)
	library.value.remove(quiz.id, quiz.version)
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
		let repeated: { readonly file: string, readonly duplicates: readonly RepeatedQuestion[] } | undefined
		// Dev builds only: the samples come in once they are validated.
		let samples: readonly LibraryEntry[] = []

		const read = (file: File, result: ReadQuiz) => {
			if ('problems' in result) {
				failed = { file: file.name, problems: result.problems }
				repeated = undefined
				showNotices()
				return
			}
			failed = undefined
			repeated = result.duplicates === undefined ? undefined : { file: file.name, duplicates: result.duplicates }
			// Chosen first, so the new card comes in checked.
			selection.value.chooseQuiz(result.quiz)
			library.value.add({ quiz: result.quiz, file: result.file })
			showNotices()
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
				...quizzesIn(state, samples).map(({ entry, kept }) => create(QuizCard, {
					quiz: entry.quiz,
					chosen: same(entry.quiz, chosen),
					choose: () => {
						selection.value.chooseQuiz(entry.quiz)
						if (!kept) library.value.add(entry)
					},
					remove: kept ? () => { remove(entry.quiz) } : undefined,
				})),
			)
		}

		const showNotices = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			notices.replaceChildren(
				...failed === undefined
					? []
					: [create(LoadProblems, failed)],
				...repeated === undefined
					? []
					: [create(DuplicatesNotice, repeated)],
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
		if (import.meta.env.DEV) {
			void sampleQuizzes().then((found) => {
				if (signal.aborted) return
				samples = found
				showShelf(snapshot<LibraryState>(library))
			})
		}
		selection.on('change', signal, () => {
			showNotices()
		})
	},
})
