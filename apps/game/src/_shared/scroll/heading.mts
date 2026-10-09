/**
 * The line at the top of the scroll: `AMBUSH · MULTIPLE · CHOOSE 2 · 4 NINJAS`
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)).
 */

import type { Question } from '@bunbu/data'
import type { AmbushState, Mark } from '../state/ambush.mts'

/** The arrow for each swipe direction, as the scroll and the mark legend show it. */
export const arrows: Readonly<Record<Mark, string>> = {
	up: '↑',
	'up-right': '↗',
	right: '→',
	'down-right': '↘',
	down: '↓',
	'down-left': '↙',
	left: '←',
	'up-left': '↖',
}

/** How many ninjas carry the options. Several options share one when there are 6 to 8. */
export function ninjaCount(ambush: AmbushState): number {
	return new Set(ambush.options.map((option) => option.ninja)).size
}

/** Whether some ninja carries more than one option, so the scroll says which ninja has which. */
export function bundled(ambush: AmbushState): boolean {
	return ambush.kind !== 'yes-no' && ninjaCount(ambush) < ambush.options.length
}

/** The ninja's name on the scroll: A, B, C … */
export function ninjaName(ninja: number): string {
	return String.fromCodePoint('A'.codePointAt(0)! + ninja)
}

/**
 * The heading: the label (`AMBUSH` in a run, `PRACTICE` in the dojo), the question type, which
 * round of a `solutions` or `match` question this is, how many to choose for `multiple`, and the
 * ninjas.
 * `yes-no` is always one ninja, so it doesn't say so.
 */
export function headingOf(label: string, ambush: AmbushState, type: Question['type'] | undefined): string {
	const ninjas = ninjaCount(ambush)
	const parts = [
		label,
		(type ?? ambush.kind).toUpperCase(),
		ambush.rounds > 1 ? `${ambush.round} OF ${ambush.rounds}` : undefined,
		ambush.kind === 'multiple' && ambush.choose > 0 ? `CHOOSE ${ambush.choose}` : undefined,
		bundled(ambush) ? `${ambush.options.length} OPTIONS` : undefined,
		ambush.kind === 'yes-no' ? undefined : `${ninjas} ${ninjas === 1 ? 'NINJA' : 'NINJAS'}`,
	]
	return parts.filter((part) => part !== undefined).join(' · ')
}
