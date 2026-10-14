/**
 * What practice's speaker button says ([D4](../../../../docs/design/screens.md#d4-practice-ambush),
 * [D5](../../../../docs/design/screens.md#d5-practice-miss)), line by line: each block of quiz
 * Markdown in turn, a sentence a line, as it is read aloud.
 */

import { sentencesOf, spokenLine, type Pronouncer, type SpokenLine } from '../_shared/speech/line.mts'
import { readableMarkdown } from '../_shared/speech/readable.mts'

/**
 * The lines to read for quiz Markdown, a sentence each: `blocks` in turn, as on the card. A block
 * of plain words, such as "The answer is", is said as it is.
 */
export function linesOfBlocks(blocks: readonly string[], pronouncer: Pronouncer): SpokenLine[] {
	// As shown text, not only said: the pronouncer only goes over what is shown. Nothing is
	// highlighted here, so where it is shown doesn't matter.
	return blocks.flatMap((source, block) => {
		const text = readableMarkdown(source)
		return sentencesOf(text).map(({ start, end }) => spokenLine([{ shown: text.slice(start, end), block, offset: start }], pronouncer))
	})
}
