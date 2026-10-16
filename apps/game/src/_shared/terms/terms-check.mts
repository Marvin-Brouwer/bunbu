/**
 * Asks again once the app opens, when terms changed since the player agreed to them: one scroll per
 * set of terms, for every quiz they agreed to under the old version. Without agreeing, those quizzes
 * come off the library, as with Remove; their high scores stay.
 */

import { component, environment } from '@rooted/components'
import { agreementKey, agreements, termsKinds, type AgreementsState, type TermsKind } from '../state/agreements.mts'
import { selection } from '../state/selection.mts'
import { loaded } from '../loading.mts'
import { snapshot } from '../state/store.mts'
import { library, type LibraryEntry, type LibraryState } from '../storage/library.mts'
import { TermsScroll } from './terms-scroll.mts'
import { terms } from './terms.mts'

const titles = new Intl.ListFormat('en', { type: 'conjunction' })

/** The quizzes in the library agreed to under an older version of `kind`. */
function outdated(kind: TermsKind): LibraryEntry[] {
	const { agreed } = snapshot<AgreementsState>(agreements)
	return snapshot<LibraryState>(library).entries.filter(({ quiz }) => {
		const agreement = agreed[agreementKey(quiz.id, quiz.version)]
		return agreement?.terms === kind && agreement.termsVersion !== terms[kind].version
	})
}

export const TermsCheck = component({
	name: 'terms-check',
	onMount({ append, create, signal }) {
		if (environment.is('preRenderer')) return

		const ask = (kind: TermsKind, entries: readonly LibraryEntry[]) => new Promise<boolean>((resolve) => {
			const many = entries.length > 1
			const scroll: Element = create(TermsScroll, {
				terms: kind,
				about: `The terms changed since you loaded ${titles.format(entries.map(({ quiz }) => quiz.title))}. `
					+ (many
						? 'Without agreeing, they come off your quizzes; their high scores stay.'
						: 'Without agreeing, it comes off your quizzes; its high score stays.'),
				decline: 'Remove',
				closed: (agreed) => {
					scroll.remove()
					resolve(agreed)
				},
			})
			append(
				scroll
			)
		})

		/** Asks about the quizzes agreed to under older terms of `kind`, then keeps or removes them. */
		const recheck = async (kind: TermsKind) => {
			const entries = outdated(kind)
			if (entries.length === 0) return
			const agreed = await ask(kind, entries)
			if (signal.aborted) return
			for (const { quiz } of entries) {
				const agreement = snapshot<AgreementsState>(agreements).agreed[agreementKey(quiz.id, quiz.version)]!
				if (agreed) {
					agreements.value.agree(quiz.id, quiz.version, { ...agreement, termsVersion: terms[kind].version })
					continue
				}
				selection.value.forgetQuiz(quiz.id, quiz.version)
				library.value.remove(quiz.id, quiz.version)
				agreements.value.forget(quiz.id, quiz.version)
			}
		}

		// One scroll at a time, once the loading screen has gone: a dialog would open over it.
		const check = () => termsKinds.reduce((asked, kind) => asked.then(() => recheck(kind)), loaded())

		// Once, as soon as the saved quizzes are back.
		if (library.value.restored) {
			void check()
			return
		}
		let checked = false
		library.on('change', signal, ({ detail }) => {
			if (checked || !detail.state.restored) return
			checked = true
			void check()
		})
	},
})
