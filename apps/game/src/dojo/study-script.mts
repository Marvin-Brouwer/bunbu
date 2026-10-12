/**
 * What a study card says, line by line ([D2 Study](../../../../docs/design/dojo.md#study)): each
 * sentence of what is asked, then each answer with its lead, "the answer is …". Built from the
 * text of the card's blocks as they are read aloud, so the spoken word can be found on the card.
 */

import type { Markdown } from '@bunbu/data'
import { sentencesOf, spokenLine, type LinePiece, type Pronouncer, type SpokenLine } from '../_shared/speech/line.mts'
import type { StudyCard } from './state/study-card.mts'

/** The card's blocks of Markdown in the order they are shown: what is asked, then each answer's prompt and text. */
export function blocksOf(card: StudyCard): Markdown[] {
	return [
		...card.asked,
		...card.answers.flatMap((answer) => answer.prompt === undefined ? [answer.text] : [answer.prompt, answer.text]),
	]
}

/** A whole block as one piece, without the space around it. */
function wholeBlock(text: string, block: number): LinePiece[] {
	const trimmed = text.trim()
	return trimmed === '' ? [] : [{ shown: trimmed, block, offset: text.length - text.trimStart().length }]
}

const saying = (said: string | undefined): LinePiece[] => said === undefined || said === '' ? [] : [{ said }]

/**
 * The lines of a card. `texts` holds the text of each of {@link blocksOf}'s blocks as it is read
 * aloud ([readable](../_shared/speech/readable.mts)).
 */
export function linesOf(card: StudyCard, texts: readonly string[], pronouncer: Pronouncer): SpokenLine[] {
	const asked = card.asked.flatMap((_, block) => {
		const text = texts[block] ?? ''
		return sentencesOf(text).map(({ start, end }) => spokenLine([{ shown: text.slice(start, end), block, offset: start }], pronouncer))
	})

	let block = card.asked.length
	const answers = card.answers.map((answer) => {
		const pieces: LinePiece[] = [...saying(answer.lead)]
		if (answer.prompt !== undefined) {
			pieces.push(...wholeBlock(texts[block] ?? '', block), ...saying(answer.link))
			block++
		}
		pieces.push(...wholeBlock(texts[block] ?? '', block))
		block++
		return spokenLine(pieces, pronouncer)
	})

	return [...asked, ...answers].filter((line) => line.text.trim() !== '')
}
