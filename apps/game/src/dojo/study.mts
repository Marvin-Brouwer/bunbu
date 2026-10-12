/**
 * D2 Study ([dojo.md](../../../../docs/design/dojo.md#study)): every question with its correct
 * answer, shuffled, read aloud on a loop, the spoken word highlighted. Pause, Restart, Voice and
 * Speed; no previous or next.
 *
 * The screen stays on while it is up, without going full screen. Locking the phone anyway doesn't
 * stop the reading where the phone lets it go on ([speaker](../_shared/speech/speaker.mts)).
 *
 * The study session's state lives as long as this screen: created on mount, dropped on unmount,
 * which stops the speech.
 */

import { resolvePronunciations, type BunbuData } from '@bunbu/data'
import { component, type CssClass } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { href } from '@rooted/router'
import { renderMarkdown } from '../_shared/markdown/render.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { MenuSection } from '../_shared/menu/menu-section.mts'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import scrollStyles from '../_shared/scroll/scroll.css'
import { keepScreenOn } from '../_shared/screen-on.mts'
import { pronouncerOf, type SpokenLine } from '../_shared/speech/line.mts'
import { readableMarkdown, readableText, type Readable } from '../_shared/speech/readable.mts'
import { canSpeak, createSpeaker, voicesFor, watchVoices } from '../_shared/speech/speaker.mts'
import { shuffle } from '../_shared/state/random.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { DojoRoute } from './_routes.mts'
import { fastest, rateStep, slowest, type ReadingState } from './state/study.mts'
import { createStudyGame } from './state/study.mts'
import { studyCardOf, type StudyCard } from './state/study-card.mts'
import { blocksOf, linesOf } from './study-script.mts'
import styles from './study.css'

/** The highlight of the spoken word ([CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API)). */
const highlightName = 'spoken-word'

/** Each line of the loop, with the card it is on. */
type Entry = {
	readonly card: number
	readonly line: SpokenLine
}

const rateOf = (rate: number) => `${rate}×`

const sameWord = (first: ReadingState['word'], second: ReadingState['word']) => first?.block === second?.block
	&& first?.start === second?.start
	&& first?.end === second?.end

/** Asks for a quiz when none is chosen. */
const NoQuiz = component({
	name: 'study-no-quiz',
	styles,
	onMount({ append, create, element }) {
		append(
			create(MenuScreen, {
				title: 'Study',
				back: href.for(DojoRoute),
				children: [
					element('p', {
						classes: styles.note,
						textContent: 'Choose a quiz to study first.',
					}),
					create(MenuButton, {
						kind: 'primary',
						label: 'Choose a quiz',
						href: href.for(QuizzesRoute),
					}),
				],
			})
		)
	},
})

/**
 * The chosen quiz's study, or the way to choose one. Opened straight from a link, the saved quiz
 * comes back a moment after the screen is up.
 */
export const Study = component({
	name: 'study',
	onMount({ create, replace, signal }) {
		/** The quiz on screen, by id and version; `''` for none. */
		let studying: string | undefined
		const show = () => {
			const { quiz } = snapshot(selection)
			const key = quiz === undefined ? '' : `${quiz.id}@${quiz.version}`
			if (key === studying) return
			studying = key
			replace(quiz === undefined ? create(NoQuiz) : create(StudySession, { quiz }))
		}
		selection.on('change', signal, show)
		show()
	},
})

type StudySessionOptions = {
	readonly quiz: BunbuData
}

const StudySession = component<StudySessionOptions>({
	name: 'study-session',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { quiz } = options
		const game = createStudyGame()
		const reading = game.reading
		const pronouncer = pronouncerOf(resolvePronunciations(quiz))
		const cardOf = (index: number): StudyCard | undefined => {
			const question = game.quiz.value.question({ question: game.quiz.value.order[index] ?? -1, part: 0 })
			return question === undefined ? undefined : studyCardOf(question)
		}

		/** Every line of the loop, in reading order. Built when the quiz is shuffled. */
		let entries: Entry[] = []
		const shuffleQuiz = () => {
			game.quiz.value.load(quiz, shuffle(quiz.questions.map((_, index) => index), Math.random))
			entries = game.quiz.value.order.flatMap((_, card) => {
				const studyCard = cardOf(card)
				if (studyCard === undefined) return []
				const texts = blocksOf(studyCard).map((block) => readableMarkdown(block))
				return linesOf(studyCard, texts, pronouncer).map((line) => ({ card, line }))
			})
		}
		const entryAt = (place: number) => entries.length === 0 ? undefined : entries[place % entries.length]

		const speaker = createSpeaker({
			language: quiz.language,
			whileHidden: 'keep reading',
			lineAt: (place) => entryAt(place)?.line,
			onLine(place) {
				const card = entryAt(place)?.card
				if (card !== undefined && card !== reading.value.card) reading.value.reach(card)
			},
			onWord(word) {
				reading.value.speak(word)
			},
			onStop() {
				reading.value.pause()
			},
		}, signal)

		// The card: its blocks of Markdown, each in an element of its own to find the spoken word in.
		const sheet = element('div', {
			classes: styles.card,
		})
		let blockElements: HTMLElement[] = []
		let readables: (Readable | undefined)[] = []
		const markdownBlock = (source: string, classes: CssClass) => element('div', {
			classes,
			children: create(Markdown, {
				source: renderMarkdown(source),
				classes: scrollStyles.markdown,
			}),
		})

		const showCard = (index: number) => {
			const card = cardOf(index)
			if (card === undefined) return
			const sources = blocksOf(card)
			blockElements = []
			readables = []
			const next = (classes: CssClass) => {
				const block = markdownBlock(sources[blockElements.length] ?? '', classes)
				blockElements.push(block)
				return block
			}

			const asked = card.asked.map(() => next(styles.asked))
			const answers = card.answers.map((answer) => element('li', {
				classes: styles.answer,
				children: [
					...answer.prompt === undefined ? [] : [next(styles.prompt)],
					next(styles.answerText),
				],
			}))

			sheet.replaceChildren(
				element('p', {
					classes: styles.type,
					textContent: card.type,
				}),
				...asked,
				element('section', {
					classes: styles.correct,
					children: [
						element('h2', {
							classes: styles.correctLabel,
							textContent: card.label,
						}),
						element(card.ordered ? 'ol' : 'ul', {
							classes: styles.answers,
							'data-type': card.type,
							children: answers,
						}),
					],
				}),
			)
		}

		/** Marks the spoken word, where the browser can mark text. */
		const highlight = (word: ReadingState['word']) => {
			if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
			if (word === undefined) {
				CSS.highlights.delete(highlightName)
				return
			}
			const host = blockElements[word.block]
			if (host === undefined) return
			readables[word.block] ??= readableText(host)
			const range = readables[word.block]?.rangeOf(word.start, word.end)
			if (range === undefined) CSS.highlights.delete(highlightName)
			else CSS.highlights.set(highlightName, new Highlight(range))
		}
		signal.addEventListener('abort', () => { highlight(undefined) }, { once: true })

		const progress = element('span', {
			classes: styles.progress,
		})
		const status = element('span', {
			classes: styles.status,
		})
		const playButton = element('div', {
			classes: styles.playButton,
		})

		const play = () => {
			reading.value.play()
			speaker.resume()
		}
		const pause = () => {
			reading.value.pause()
			speaker.pause()
		}
		const restart = () => {
			shuffleQuiz()
			reading.value.restart()
			reading.value.play()
			showCard(0)
			showProgress(0)
			speaker.play(0)
		}

		const showPlaying = (playing: boolean) => {
			status.textContent = playing ? '▶ playing · shuffled loop' : '❚❚ paused · shuffled loop'
			status.dataset.playing = String(playing)
			playButton.replaceChildren(
				create(MenuButton, {
					kind: 'primary',
					label: playing ? 'Pause' : 'Play',
					action: playing ? pause : play,
				})
			)
		}
		const showProgress = (card: number) => {
			progress.textContent = `${quiz.title} · ${card + 1} / ${game.quiz.value.order.length}`
		}

		// Voice: the system's own for the quiz's language, or one of the voices for it.
		const voiceSelect = element('select', {
			classes: styles.voiceSelect,
			aria: {
				label: 'Voice',
			},
			on: {
				change(event) {
					const uri = event.currentTarget.value
					const voice = voicesFor(quiz.language).find((each) => each.voiceURI === uri)
					reading.value.chooseVoice(voice?.voiceURI)
					speaker.setVoice(voice)
				},
			},
		})
		watchVoices(quiz.language, signal, (voices) => {
			const chosen = reading.value.voice
			voiceSelect.replaceChildren(
				element('option', {
					value: '',
					textContent: `System (${quiz.language})`,
				}),
				...voices.map((voice) => element('option', {
					value: voice.voiceURI,
					selected: voice.voiceURI === chosen,
					textContent: `${voice.name} (${voice.lang})`,
				})),
			)
		})

		// Speed: − 1.5× +
		const rateValue = element('output', {
			classes: styles.rateValue,
			textContent: rateOf(reading.value.rate),
		})
		const rateButton = (label: string, name: string, step: number) => element('button', {
			type: 'button',
			classes: styles.rateButton,
			textContent: label,
			aria: {
				label: name,
			},
			on: {
				click() {
					reading.value.setRate(reading.value.rate + step)
					speaker.setRate(reading.value.rate)
				},
			},
		})
		const slower = rateButton('−', 'Slower', -rateStep)
		const faster = rateButton('+', 'Faster', rateStep)
		const showRate = (rate: number) => {
			rateValue.textContent = rateOf(rate)
			slower.disabled = rate <= slowest
			faster.disabled = rate >= fastest
		}

		append(
			create(MenuScreen, {
				title: 'Study',
				back: href.for(DojoRoute),
				children: [
					element('p', {
						classes: styles.state,
						children: [
							progress,
							status,
						],
					}),
					create(ScrollSheet, {
						children: sheet,
					}),
					element('div', {
						classes: styles.controls,
						children: [
							playButton,
							create(MenuButton, {
								label: '⟲ Restart',
								action: restart,
							}),
						],
					}),
					element('div', {
						classes: styles.settings,
						children: [
							create(MenuSection, {
								label: 'Voice',
								children: element('label', {
									classes: styles.group,
									children: voiceSelect,
								}),
							}),
							create(MenuSection, {
								label: 'Speed',
								children: element('div', {
									classes: [
										styles.group,
										styles.rate,
									],
									children: [
										slower,
										rateValue,
										faster,
									],
								}),
							}),
						],
					}),
					element('p', {
						classes: styles.note,
						textContent: canSpeak()
							? 'Reads every question with its answer, in a shuffled loop. Restart shuffles again. It reads on when your phone locks, where your phone allows it.'
							: 'Reading aloud doesn\'t work in this browser, but you can still go through the cards.',
					}),
				],
			})
		)

		// What is on screen, to change only what changed.
		let shown: ReadingState = { ...reading.value }
		reading.on('change', signal, ({ detail }) => {
			const { state } = detail
			if (state.card !== shown.card) {
				showCard(state.card)
				showProgress(state.card)
			}
			if (!sameWord(state.word, shown.word)) highlight(state.word)
			if (state.playing !== shown.playing) showPlaying(state.playing)
			if (state.rate !== shown.rate) showRate(state.rate)
			shown = { ...state }
		})

		keepScreenOn(signal)
		showPlaying(false)
		showRate(reading.value.rate)
		restart()
	},
})
