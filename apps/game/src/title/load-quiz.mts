/**
 * Where a quiz file comes in: drop a `.yaml` or `.bunbu` file on it, or tap it to choose one. Each
 * file read goes to `read`, which the shelf turns into a new card or into the problems with the file.
 */

import { fileExtension } from '@bunbu/data'
import { component } from '@rooted/components'
import { readQuiz, type ReadQuiz } from '../_shared/quiz/read-quiz.mts'
import styles from './quiz-shelf.css'

export type LoadQuizOptions = {
	readonly read: (file: File, result: ReadQuiz) => void
}

export const LoadQuiz = component<LoadQuizOptions>({
	name: 'load-quiz',
	styles,
	onMount({ append, element, options }) {
		// Handed on in the order they came, so the last file is the one chosen.
		const readAll = async (files: Iterable<File>) => {
			const read = await Promise.all([...files].map(async (file) => ({ file, result: await readQuiz(file) })))
			for (const { file, result } of read) options.read(file, result)
		}

		const area = append(
			element('label', {
				classes: styles.load,
				children: [
					element('input', {
						type: 'file',
						accept: `.yaml,.yml,${fileExtension}`,
						multiple: true,
						on: {
							async change(event) {
								const input = event.currentTarget
								const files = [...input.files ?? []]
								// The same file can be loaded again after it is fixed.
								input.value = ''
								await readAll(files)
							},
						},
					}),
					element('span', {
						classes: styles.loadTitle,
						textContent: '+ Load a quiz',
					}),
					element('span', {
						classes: styles.loadNote,
						textContent: `Drop a .yaml or ${fileExtension} file here, or tap to choose one`,
					}),
				],
				on: {
					dragenter(event) {
						event.preventDefault()
						area.dataset.dragging = 'true'
					},
					dragover(event) {
						// Without this the browser opens the file instead of dropping it here.
						event.preventDefault()
						if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
					},
					dragleave(event) {
						if (event.relatedTarget instanceof Node && area.contains(event.relatedTarget)) return
						delete area.dataset.dragging
					},
					async drop(event) {
						event.preventDefault()
						delete area.dataset.dragging
						await readAll(event.dataTransfer?.files ?? [])
					},
				},
			})
		)
	},
})
