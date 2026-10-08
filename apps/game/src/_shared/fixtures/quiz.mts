/** A tiny quiz the fixtures build their states from. The real samples are in `test/quizzes`. */

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
		},
		{
			type: 'single',
			query: markdown('Which attribute describes an image to a screen reader?'),
			options: [
				{ answer: markdown('`alt`'), correct: true },
				{ answer: markdown('`title`'), correct: false },
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
