import { href, type Path } from '@rooted/router'
import { route } from '@rooted/router/routes'

/** The quizzes: choose one, or load one from a file ([screens.md](../../../../docs/design/screens.md#1b-quizzes)). */
export const QuizzesRoute = route`/quizzes/`({
	async resolve({ create }) {
		const { Quizzes } = await import('./quizzes.mts')
		return create(Quizzes)
	},
	seo: { title: 'Quizzes' },
})

/** The query that sends the quizzes' back link to the dojo: `/quizzes/?from=dojo`. */
const fromQuery = 'from'
const dojo = 'dojo'

/** The quizzes, opened from the dojo, so back leads there instead of to the title. */
export function quizzesFromDojo(): Path {
	const path = href.for(QuizzesRoute)
	path.query.set(fromQuery, dojo)
	return path
}

/** Whether the quizzes at `path` were opened from the dojo. */
export function openedFromDojo(path: Path): boolean {
	return path.query.get(fromQuery) === dojo
}
