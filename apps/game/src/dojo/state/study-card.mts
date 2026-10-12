/**
 * A question as a study card ([D2 Study](../../../../../docs/design/screens.md#d2-study)): what is
 * asked, and its correct answer, shown and read aloud. What is read is the query, then "the answer
 * is …":
 *
 * - `yes-no` and `single`: the one answer.
 * - `multiple`: every correct option.
 * - `order`: the correct options in the right sequence.
 * - `solutions`: the scenario and the query, then each solution with yes or no.
 * - `match`: each row with its answer.
 */

import type { Markdown, Option, Question, QuestionType } from '@bunbu/data'

export type CardAnswer = {
	/** Said before it, not shown: "The answer is", "then". */
	readonly lead: string
	/** Shown and read before the answer: a solution, or a row of a match. */
	readonly prompt?: Markdown
	/** Said between the prompt and the answer, not shown. */
	readonly link?: string
	readonly text: Markdown
}

export type StudyCard = {
	readonly type: QuestionType
	/** What is asked, in reading order. */
	readonly asked: readonly Markdown[]
	/** Above the answer: `Correct answer`, `Right order`. */
	readonly label: string
	/** Whether the answers are a sequence, as for `order`. */
	readonly ordered: boolean
	readonly answers: readonly CardAnswer[]
}

const yes = 'Yes' as Markdown
const no = 'No' as Markdown

const correctOf = (options: readonly Option[]) => options.filter((option) => option.correct)

/** "The answers are a, b and c": the lead before each of several answers. */
function listed(texts: readonly Markdown[], first: string): CardAnswer[] {
	return texts.map((text, index) => ({
		lead: index === 0
			? first
			: index === texts.length - 1 ? 'and' : '',
		text,
	}))
}

export function studyCardOf(question: Question): StudyCard {
	switch (question.type) {
		case 'yes-no':
			return {
				type: question.type,
				asked: [question.query],
				label: 'Correct answer',
				ordered: false,
				answers: [{ lead: 'The answer is', text: question.answer === 'yes' ? yes : no }],
			}
		case 'single':
			return {
				type: question.type,
				asked: [question.query],
				label: 'Correct answer',
				ordered: false,
				answers: listed(correctOf(question.options).slice(0, 1).map((option) => option.answer), 'The answer is'),
			}
		case 'multiple': {
			const correct = correctOf(question.options).map((option) => option.answer)
			return {
				type: question.type,
				asked: [question.query],
				label: correct.length === 1 ? 'Correct answer' : 'Correct answers',
				ordered: false,
				answers: listed(correct, correct.length === 1 ? 'The answer is' : 'The answers are'),
			}
		}
		case 'order':
			return {
				type: question.type,
				asked: [question.query],
				label: 'Right order',
				ordered: true,
				answers: correctOf(question.options).map((option, index) => ({
					lead: index === 0 ? 'The right order is' : 'then',
					text: option.answer,
				})),
			}
		case 'solutions':
			return {
				type: question.type,
				asked: [question.scenario, question.query],
				label: 'Solutions',
				ordered: false,
				answers: question.options.map((option, index) => ({
					lead: `Solution ${index + 1}:`,
					prompt: option.answer,
					text: option.correct ? yes : no,
				})),
			}
		default:
			return {
				type: question.type,
				asked: [question.query],
				label: 'Matches',
				ordered: false,
				answers: question.rows.map((row) => ({
					lead: '',
					prompt: row.text,
					link: 'matches',
					text: 'answer' in row ? row.answer : correctOf(row.options)[0]?.answer ?? ('' as Markdown),
				})),
			}
	}
}
