/**
 * A missed ambush as the mistakes scroll shows it
 * ([7 Finished](../../../../../docs/design/screens.md#7-finished-results-and-mistakes)): what was
 * asked, ✗ what the player picked, ✓ the right answer, the explanations and the references.
 */

import type { BunbuData, Markdown, Option, Question, Reference } from '@bunbu/data'
import { choicesOf, type AnswerRecord } from '../../_shared/state/quiz.mts'

export type ReviewReference = {
	readonly text: string
	readonly url: string
}

export type Review = {
	readonly outcome: AnswerRecord['outcome']
	/** What was asked, in reading order, as the scroll asked it: the scenario, the solution and the query, or the query and the row. */
	readonly asked: readonly Markdown[]
	/** What the player picked, in the order they picked it. Empty when time ran out first. */
	readonly picked: readonly Markdown[]
	/** The right answer: the correct options, in their order for `order`. */
	readonly right: readonly Markdown[]
	/** Whether `picked` and `right` are a sequence, as for `order`. */
	readonly ordered: boolean
	readonly explanations: readonly Markdown[]
	readonly references: readonly ReviewReference[]
}

/** What was asked in one ambush of a question. */
function askedIn(question: Question, part: number): Markdown[] {
	switch (question.type) {
		case 'solutions': {
			const solution = question.options[part]
			return [
				question.scenario,
				...(solution === undefined ? [] : [solution.answer]),
				question.query,
			]
		}
		case 'match': {
			const row = question.rows[part]
			return [
				question.query,
				...(row === undefined ? [] : [row.text]),
			]
		}
		default:
			return [question.query]
	}
}

/** The explanation that belongs to the ambush: a solution or a row option has its own. */
function explanationsOf(question: Question, part: number, choices: readonly Option[], picked: readonly Option[]): Markdown[] {
	const own = question.type === 'solutions'
		? [question.options[part]?.explanation]
		: [
			...picked.map((option) => option.explanation),
			...choices.filter((option) => option.correct).map((option) => option.explanation),
		]
	return distinct([...own, question.explanation])
}

const distinct = (explanations: readonly (Markdown | undefined)[]): Markdown[] => [
	...new Set(explanations.filter((explanation) => explanation !== undefined)),
]

/** Only web links: quiz files are untrusted, and a `javascript:` link must never become one. */
const webLink = /^https?:\/\//i

const linksOf = (references: readonly Reference[] = []): ReviewReference[] => references
	.flatMap((reference) => Object.entries(reference))
	.filter(([, url]) => webLink.test(url))
	.map(([text, url]) => ({ text, url }))

/** The review of a missed ambush, or `undefined` when the record doesn't point into the quiz. */
export function reviewOf(quiz: BunbuData, record: AnswerRecord): Review | undefined {
	const question = quiz.questions[record.at.question]
	if (question === undefined) return undefined

	const choices = choicesOf(question, record.at.part)
	const picked = record.picked.flatMap((index) => choices[index] ?? [])
	return {
		outcome: record.outcome,
		asked: askedIn(question, record.at.part),
		picked: picked.map((option) => option.answer),
		right: choices.filter((option) => option.correct).map((option) => option.answer),
		ordered: question.type === 'order',
		explanations: explanationsOf(question, record.at.part, choices, picked),
		references: linksOf(question.references),
	}
}
