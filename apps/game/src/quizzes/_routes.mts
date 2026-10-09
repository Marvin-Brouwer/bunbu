import { route } from '@rooted/router/routes'

/** The quizzes: choose one, or load one from a file ([screens.md](../../../../docs/design/screens.md#1b-quizzes)). */
export const QuizzesRoute = route`/quizzes/`({
	async resolve({ create }) {
		const { Quizzes } = await import('./quizzes.mts')
		return create(Quizzes)
	},
	seo: { title: 'Quizzes' },
})
