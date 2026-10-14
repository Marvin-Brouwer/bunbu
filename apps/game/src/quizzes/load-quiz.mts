/**
 * Where a quiz file comes in: the Load quiz button chooses one, or a `.yaml` or `.bunbu` file is
 * dropped anywhere on the screen. The drop area under the button only says so; once a file is
 * dragged over the screen, it covers the whole screen. Touch phones don't drag files, so they only
 * get the button. A quiz file opened with or shared to the installed app comes in the same way
 * ({@link receiveOpenedQuizzes}). Each file read goes to `read`, which the shelf turns into a new card or into the
 * problems with the file.
 */

import { fileExtension } from '@bunbu/data'
import { component } from '@rooted/components'
import { quizExtensions, readQuiz, type ReadQuiz } from '../_shared/quiz/read-quiz.mts'
import { receiveOpenedQuizzes, takeSharedQuizzes } from './opened-quizzes.mts'
import styles from './quiz-shelf.css'

/** A file the browser couldn't read, such as one moved or deleted after it was chosen. */
const unreadable = (error: unknown): ReadQuiz => ({
	problems: [`The file could not be read: ${error instanceof Error ? error.message : String(error)}`],
})

/** The same check as the play guard's: a phone or tablet, which has no files to drag. */
const touchPhone = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches

/** Only a drag that carries files, not a dragged link or text. */
const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

const idleTitle = 'Or drop a quiz file here'
const draggingTitle = 'Drop it to load the quiz'

export type LoadQuizOptions = {
	/** Reads the next file only once this settles, so the player is asked about one quiz at a time. */
	readonly read: (file: File, result: ReadQuiz) => Promise<void>
}

export const LoadQuiz = component<LoadQuizOptions>({
	name: 'load-quiz',
	styles,
	onMount({ append, element, options, signal }) {
		// One file at a time, also across drops: a big batch doesn't hold every file in memory at once,
		// and the file dropped or chosen last is always the one chosen in the end.
		let queue = Promise.resolve()
		const readAll = (files: Iterable<File>) => {
			for (const file of files) {
				queue = queue.then(async () => {
					await options.read(file, await readQuiz(file).catch(unreadable))
				})
			}
			return queue
		}

		const picker = element('input', {
			type: 'file',
			classes: styles.picker,
			accept: quizExtensions.join(','),
			multiple: true,
			tabIndex: -1,
			aria: {
				hidden: 'true',
			},
			on: {
				async change(event) {
					const input = event.currentTarget
					const files = [...input.files ?? []]
					// The same file can be loaded again after it is fixed.
					input.value = ''
					await readAll(files)
				},
			},
		})

		const dropTitle = element('span', {
			classes: styles.dropTitle,
			textContent: idleTitle,
		})
		const area = element('div', {
			classes: styles.dropArea,
			children: [
				dropTitle,
				element('span', {
					classes: styles.dropNote,
					textContent: `A .yaml or ${fileExtension} file`,
				}),
			],
		})
		const drop = element('div', {
			classes: styles.drop,
			children: area,
		})

		append(
			element('div', {
				classes: styles.loading,
				children: [
					picker,
					element('div', {
						classes: styles.load,
						children: [
							// Room for more ways to get a quiz later, such as a quiz builder.
							element('div', {
								classes: styles.loadText,
								children: [
									element('span', {
										classes: styles.loadTitle,
										textContent: 'Load a quiz',
									}),
									element('span', {
										classes: styles.loadNote,
										textContent: `A .yaml quiz you wrote, or a ${fileExtension} quiz someone shared`,
									}),
								],
							}),
							element('button', {
								type: 'button',
								classes: styles.cardAction,
								children: [
									element('span', {
										classes: [
											styles.cardIcon,
											styles.uploadIcon,
										],
									}),
									'Load quiz',
								],
								on: {
									click() {
										picker.click()
									},
								},
							}),
						],
					}),
					drop,
				],
			}),
		)

		receiveOpenedQuizzes(readAll)
		void takeSharedQuizzes().then(readAll)

		if (touchPhone()) return

		// Every element the drag passes over enters and leaves, so count them: back at none, the drag
		// has left the screen.
		let entered = 0
		const startDragging = () => {
			// The area leaves its place to cover the screen; its place keeps its height, so the quizzes
			// under it don't jump up.
			drop.style.minBlockSize = `${drop.offsetHeight}px`
			area.dataset.dragging = 'true'
			dropTitle.textContent = draggingTitle
		}
		const stopDragging = () => {
			entered = 0
			delete area.dataset.dragging
			dropTitle.textContent = idleTitle
			drop.style.removeProperty('min-block-size')
		}

		const listen = { signal }
		document.addEventListener('dragenter', (event) => {
			if (!carriesFiles(event)) return
			event.preventDefault()
			if (entered === 0) startDragging()
			entered += 1
		}, listen)
		document.addEventListener('dragover', (event) => {
			if (!carriesFiles(event)) return
			// Without this the browser opens the file instead of dropping it here.
			event.preventDefault()
			if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
		}, listen)
		document.addEventListener('dragleave', (event) => {
			if (!carriesFiles(event) || entered === 0) return
			entered -= 1
			if (entered === 0) stopDragging()
		}, listen)
		document.addEventListener('drop', (event) => {
			if (!carriesFiles(event)) return
			event.preventDefault()
			stopDragging()
			void readAll(event.dataTransfer?.files ?? [])
		}, listen)
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && area.dataset.dragging !== undefined) stopDragging()
		}, listen)
	},
})
