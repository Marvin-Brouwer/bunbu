/**
 * The terms a player agrees to before a quiz joins their quizzes
 * ([terms](../../../../../docs/design/screens.md#terms)): one set for a quiz they wrote (a `.yaml`
 * file), one for a quiz shared with them (a `.bunbu` file). Each is a Markdown file in this folder
 * with a `title` and a `version` in its frontmatter. Raise the `version` when the terms change, and
 * the player is asked again for every quiz they agreed to under the old ones.
 */

import type { MarkdownModule } from '@rooted/markdown'
import type { Agreement, TermsKind } from '../state/agreements.mts'
import sharedQuiz from './shared-quiz.md'
import writtenQuiz from './written-quiz.md'

export type Terms = {
	/** The heading of the scroll that asks. */
	readonly title: string
	readonly version: number
	readonly source: MarkdownModule
}

const termsOf = (source: MarkdownModule): Terms => {
	const { title, version } = source.frontmatter as { title: string, version: number }
	return { title, version, source }
}

export const terms: Readonly<Record<TermsKind, Terms>> = {
	written: termsOf(writtenQuiz),
	shared: termsOf(sharedQuiz),
}

/** What agreeing to `kind` means for this quiz file: its content, and the terms as they are now. */
export async function agreementFor(file: Uint8Array, kind: TermsKind): Promise<Agreement> {
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(file)))
	return {
		content: [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		terms: kind,
		termsVersion: terms[kind].version,
	}
}
