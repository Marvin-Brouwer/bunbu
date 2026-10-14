/**
 * Which terms the player agreed to for each loaded quiz, by quiz `id` + `version`
 * ([terms](../../../../../docs/design/screens.md#terms)). App-wide and saved, so a quiz loaded
 * again unchanged isn't asked about twice, and new terms are asked about once the app opens.
 */

import { createStore, type Store } from '@rooted/store'

/** The terms a quiz is loaded under: one the player wrote (a `.yaml` file), or one shared with them (a `.bunbu` file). */
export const termsKinds = ['written', 'shared'] as const

export type TermsKind = (typeof termsKinds)[number]

/** What the player agreed to when a quiz was loaded. */
export type Agreement = {
	/** The quiz's `.bunbu` file as a SHA-256 hash, so a changed quiz of the same version is asked about again. */
	readonly content: string
	readonly terms: TermsKind
	/** The `version` in the frontmatter of the terms' Markdown file. */
	readonly termsVersion: number
}

export type AgreementsState = {
	/** By {@link agreementKey}. */
	readonly agreed: Readonly<Record<string, Agreement>>
}

export type AgreementsActions = {
	/** Whether the player agreed to exactly this already: the same quiz content under the same terms. */
	holds: (id: string, version: string, agreement: Agreement) => boolean
	agree: (id: string, version: string, agreement: Agreement) => void
	forget: (id: string, version: string) => void
	/** Puts back what was saved. */
	restore: (saved: Readonly<Record<string, Agreement>>) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Agreements = Store<AgreementsState & AgreementsActions>

export const noAgreements: AgreementsState = { agreed: {} }

export function agreementKey(id: string, version: string): string {
	return JSON.stringify([id, version])
}

export function createAgreements(initial: AgreementsState = noAgreements): Agreements {

	const store: Agreements = createStore<AgreementsState & AgreementsActions>({
		...initial,

		holds(id, version, agreement) {
			const agreed = store.value.agreed[agreementKey(id, version)]
			return agreed !== undefined
				&& agreed.content === agreement.content
				&& agreed.terms === agreement.terms
				&& agreed.termsVersion === agreement.termsVersion
		},

		agree(id, version, agreement) {
			store.update((state) => ({ agreed: { ...state.agreed, [agreementKey(id, version)]: agreement } }))
		},

		forget(id, version) {
			const key = agreementKey(id, version)
			store.update((state) => ({ agreed: Object.fromEntries(Object.entries(state.agreed).filter(([each]) => each !== key)) }))
		},

		restore(saved) {
			store.update((state) => ({ agreed: { ...saved, ...state.agreed } }))
		},

		reset() {
			store.update(() => noAgreements)
		},
	})
	return store
}

/** App-wide: the quizzes screen asks when a quiz loads, the app when it opens. */
export const agreements = createAgreements()
