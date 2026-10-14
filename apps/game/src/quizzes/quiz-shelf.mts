/**
 * The button and area to load a quiz file, then why the last file didn't load and what won't fit in
 * a fight of the chosen quiz, then the loaded quizzes as cards, one to choose. A quiz only joins the
 * library once the player agreed to its terms, unless they already did for the same quiz.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { library, type LibraryEntry, type LibraryState } from '../_shared/storage/library.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { agreements } from '../_shared/state/agreements.mts'
import { TermsScroll } from '../_shared/terms/terms-scroll.mts'
import { agreementFor } from '../_shared/terms/terms.mts'
import { sampleQuizzes } from '../_temp/sample-quizzes.mts'
import { LoadQuiz } from './load-quiz.mts'
import { QuizCard } from './quiz-card.mts'
import { FitNotice, LoadProblems } from '../_shared/quiz/quiz-notices.mts'
import { fitNotesOf, type ReadQuiz } from '../_shared/quiz/read-quiz.mts'
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
		// Dev builds only: the samples come in once they are validated.
		let samples: readonly LibraryEntry[] = []

		/** Whether the player agrees to the quiz's terms: asked on a scroll, unless they did for this same quiz. */
		const agreesTo = async (file: File, { quiz, file: packed, terms }: Extract<ReadQuiz, { quiz: unknown }>) => {
			const agreement = await agreementFor(packed.value, terms)
			if (agreements.value.holds(quiz.id, quiz.version, agreement)) return true
			const agreed = await new Promise<boolean>((resolve) => {
				const scroll: Element = create(TermsScroll, {
					terms,
					about: `${quiz.title}, from ${file.name}`,
					decline: 'Cancel',
					closed: (accepted) => {
						scroll.remove()
						resolve(accepted)
					},
				})
				append(
					scroll
				)
			})
			if (agreed) agreements.value.agree(quiz.id, quiz.version, agreement)
			return agreed
		}

		const read = async (file: File, result: ReadQuiz) => {
			if ('problems' in result) {
				failed = { file: file.name, problems: result.problems }
				showNotices()
				return
			}
			failed = undefined
			if (!await agreesTo(file, result)) {
				showNotices()
				return
			}
			// Chosen first, so the new card comes in checked.
			selection.value.chooseQuiz(result.quiz)
			library.value.add({ quiz: result.quiz, file: result.file })
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
