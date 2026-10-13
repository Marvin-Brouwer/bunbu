/**
 * D2 Study ([dojo.md](../../../../docs/design/dojo.md#study)): every question with its correct
 * answer, shuffled, read aloud on a loop, the spoken word highlighted. The text scrolls on the
 * page; Pause and Skip are docked at the bottom, and the settings (the voice and the speed among
 * them) open in place from the top right, so the reading goes on.
 *
 * The screen stays on while it is up, without going full screen. Locking the phone anyway doesn't
 * stop the reading where the phone lets it go on ([speaker](../_shared/speech/speaker.mts)).
 *
 * The study session's state lives as long as this screen: created on mount, dropped on unmount,
 * which stops the speech.
 */

import { resolvePronunciations, type BunbuData } from '@bunbu/data'
import { component, type CssClass } from '@rooted/components'
import { href } from '@rooted/router'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { SettingsForm } from '../_shared/menu/settings-form.mts'
import menuStyles from '../_shared/menu/menu.css'
import { keepScreenOn } from '../_shared/screen-on.mts'
import { pronouncerOf, type SpokenLine } from '../_shared/speech/line.mts'
import { readableMarkdown, readableText, type Readable } from '../_shared/speech/readable.mts'
import { canSpeak, createSpeaker, voiceFor, watchVoices } from '../_shared/speech/speaker.mts'
import { shuffle } from '../_shared/state/random.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { DojoRoute } from './_routes.mts'
import { languageOf, settings } from '../settings/state/settings.mts'
import { createStudyGame, type ReadingState } from './state/study.mts'
import { studyCardOf, type StudyCard } from './state/study-card.mts'
import { CardBlock } from './card-block.mts'
import { blocksOf, linesOf } from './study-script.mts'
import styles from './study.css'

/** The highlight of the spoken word ([CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API)). */
const highlightName = 'spoken-word'

/** Each line of the loop, with the card it is on. */
type Entry = {
	readonly card: number
	readonly line: SpokenLine
}

/** A cog, for the settings button. */
const cog = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.2 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>'

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
		const sheet = element('article', {
			classes: styles.card,
		})
		let blockElements: HTMLElement[] = []
		let readables: (Readable | undefined)[] = []

		const showCard = (index: number) => {
			const card = cardOf(index)
			if (card === undefined) return
			const sources = blocksOf(card)
			blockElements = []
			readables = []
			const next = (classes: CssClass) => {
				const block = create(CardBlock, {
					source: sources[blockElements.length] ?? '',
					classes,
				})
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

		/** Keeps the block being read in view, when the card is taller than the screen. */
		const followBlock = (block: number) => {
			// The block's host has no box of its own; its element inside has.
			blockElements[block]?.firstElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
		}

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
		/** On to the next card, read aloud or not, so the cards can be gone through without sound. */
		const skip = () => {
			const card = reading.value.card
			const from = speaker.place()
			let place = from
			while (entryAt(place)?.card === card && place < from + entries.length) place++
			reading.value.reach(entryAt(place)?.card ?? 0)
			speaker.moveTo(place)
		}

		const showPlaying = (playing: boolean) => {
			status.textContent = !canSpeak()
				? 'reading aloud doesn\'t work in this browser'
				: playing ? '▶ playing · shuffled loop' : '❚❚ paused · shuffled loop'
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

		// The text: the card, or the settings in its place.
		const text = element('div', {
			classes: styles.text,
			children: sheet,
		})
		const settingsButton = element('button', {
			type: 'button',
			classes: menuStyles.headerButton,
			innerHTML: cog,
			aria: {
				label: 'Settings',
				pressed: 'false',
			},
			on: {
				click() {
					showSettings(settingsButton.getAttribute('aria-pressed') !== 'true')
				},
			},
		})
		// The settings while open. The card stays in the page, hidden: taken out and put back, its
		// blocks would mount again and show their text twice.
		let settingsPanel: HTMLElement | undefined
		const showSettings = (open: boolean) => {
			settingsButton.setAttribute('aria-pressed', String(open))
			text.scrollTop = 0
			sheet.hidden = open
			settingsPanel?.remove()
			settingsPanel = undefined
			if (!open) return
			settingsPanel = element('div', {
				classes: styles.settings,
				children: [
					create(SettingsForm, {
						running: false,
					}),
					create(MenuButton, {
						label: 'Done',
						action: () => { showSettings(false) },
					}),
				],
			})
			text.append(settingsPanel)
		}

		// The voice and the speed come from the settings, and follow them while reading.
		const language = languageOf(quiz.language)
		let voice: string | undefined
		const followVoice = () => {
			const chosen = voiceFor(quiz.language, settings.value.voices[language])?.voiceURI
			if (chosen === voice) return
			voice = chosen
			speaker.setVoice(voiceFor(quiz.language, chosen))
		}
		let rate = settings.value.speechRate
		speaker.setRate(rate)
		settings.on('change', signal, ({ detail }) => {
			if (detail.state.speechRate !== rate) {
				rate = detail.state.speechRate
				speaker.setRate(rate)
			}
			followVoice()
		})
		// Voices load late; the chosen one is taken once it is there.
		watchVoices(quiz.language, signal, followVoice)

		append(
			create(MenuScreen, {
				title: 'Study',
				back: href.for(DojoRoute),
				action: settingsButton,
				children: [
					element('p', {
						classes: styles.state,
						children: [
							progress,
							status,
						],
					}),
					text,
				],
				dock: [
					playButton,
					create(MenuButton, {
						label: 'Skip',
						action: skip,
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
				if (!sheet.hidden) text.scrollTop = 0
			}
			if (!sameWord(state.word, shown.word)) highlight(state.word)
			if (state.word !== undefined && state.word.block !== shown.word?.block) followBlock(state.word.block)
			if (state.playing !== shown.playing) showPlaying(state.playing)
			shown = { ...state }
		})

		keepScreenOn(signal)
		shuffleQuiz()
		showCard(0)
		showProgress(0)
		showPlaying(false)
		if (!canSpeak()) return
		reading.value.play()
		speaker.play(0)
	},
})
