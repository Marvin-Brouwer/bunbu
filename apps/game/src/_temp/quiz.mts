/**
 * A tiny quiz the fixtures build their states from, and the quiz a dev run starts on. Temporary:
 * it goes once quizzes load for real. The real samples are in `docs/testdata/`.
 */

import type { BunbuData, Markdown } from '@bunbu/data'

const markdown = (text: string) => text as Markdown

export const fixtureQuiz: BunbuData = {
	id: 'fixture',
	title: 'Fixture quiz',
	version: '1',
	language: 'en',
	passingScore: 70,
	questions: [
		{
			type: 'yes-no',
			query: markdown('Is `PUT` idempotent?'),
			answer: 'yes',
			explanation: markdown('`PUT` replaces the resource with the given state, so repeating it leaves the same state.'),
			references: [{ 'RFC 9110, section 9.2.2': 'https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2' }],
		},
		{
			type: 'single',
			query: markdown('Which attribute describes an image to a screen reader?'),
			explanation: markdown('`alt` is the text alternative for an image.'),
			options: [
				{ answer: markdown('`alt`'), correct: true },
				{ answer: markdown('`title`'), correct: false, explanation: markdown('`title` is a tooltip, which screen readers don\'t reliably read.') },
				{ answer: markdown('`caption`'), correct: false },
			],
		},
		{
			type: 'multiple',
			query: markdown('Which HTTP methods are **safe**?'),
			options: [
				{ answer: markdown('`GET`'), correct: true },
				{ answer: markdown('`HEAD`'), correct: true },
				{ answer: markdown('`POST`'), correct: false },
				{ answer: markdown('`DELETE`'), correct: false },
			],
		},
		{
			type: 'order',
			query: markdown('Order these from **lowest** to **highest** precedence.'),
			options: [
				{ answer: markdown('User-agent stylesheet'), correct: true },
				{ answer: markdown('Author stylesheet'), correct: true },
				{ answer: markdown('Inline `style` attribute'), correct: true },
			],
		},
	],
}

/** Seven options on seven marks, for the bundling fixture. */
export const manyOptions = [
	'`GET`', '`HEAD`', '`POST`', '`PUT`', '`PATCH`', '`DELETE`', '`OPTIONS`',
].map((answer, index) => ({ answer: markdown(answer), correct: index < 3 }))
