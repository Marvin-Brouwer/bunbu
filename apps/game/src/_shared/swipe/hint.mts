/**
 * The brush-lettered line over the answers in the answer drawer
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)).
 */

import type { AmbushState } from '../state/ambush.mts'

/** How to answer. One short line. */
export function hintOf(state: Pick<AmbushState, 'kind' | 'choose'>): string {
	if (state.kind === 'yes-no' || state.kind === 'single') return 'Cut your answer'
	if (state.kind === 'order') return 'Cut them in order, then hold still'
	if (state.choose > 0) return `Cut the ${state.choose} you choose, then hold still`
	return 'Cut each answer you choose, then hold still'
}
