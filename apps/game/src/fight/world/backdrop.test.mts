/**
 * The backdrop on every stage's path: nothing nearer the path than its row starts, also past a bend,
 * and nothing laid out or taken away where it could be seen through the fog (#128).
 */

import { describe, expect, it } from 'vitest'
import { backdropReach, layTile, tileLength, type BackdropRow } from './backdrop.mts'
import { bambooRound } from './bamboo-forest.mts'
import { castleRound } from './edo-castle.mts'
import { fogFar } from './landscape.mts'
import { mountainRound } from './mountain-temple.mts'
import { createPath, townRound, type Leg } from './path.mts'
import { riceRound } from './rice-fields.mts'

const rounds: readonly (readonly [string, readonly Leg[]])[] = [
	['castle town', townRound],
	['rice fields', riceRound],
	['bamboo forest', bambooRound],
	['mountain temple', mountainRound],
	['edo castle', castleRound],
]

/** The farthest any stage's backdrop stands from the path, with the size of what stands there. */
const farthest = 135 + 40

const rows: readonly BackdropRow[] = [
	{ shape: 'pine', from: 32, to: 130, perTile: 3, colours: [[0], [0]] },
	{ shape: 'broadleaf', from: 40, to: 110, perTile: 2, colours: [[0], [0]] },
]

describe('the backdrop', () => {
	for (const [name, round] of rounds) {
		it(`keeps everything on ${name} as far from the path as its row says, also past a bend`, () => {
			const path = createPath(round)
			for (let seed = 1; seed <= 6; seed++) {
				for (let tile = 0; tile < Math.ceil((2 * path.round) / tileLength); tile++) {
					for (const item of layTile(path, [{ name: 'test', rows }], seed, tile, 0)) {
						const [part] = item.parts
						if (part === undefined) continue
						const x = part.matrix.elements[12]
						const z = part.matrix.elements[14]
						const near = (tile + 0.5) * tileLength
						let nearest = Infinity
						for (let distance = near - 700; distance <= near + 700; distance += 1) {
							const point = path.at(distance)
							nearest = Math.min(nearest, Math.hypot(point.x - x, point.z - z))
						}
						expect(nearest, `${name}, seed ${seed}, tile ${tile}`).toBeGreaterThan(Math.min(...rows.map((row) => row.from)) - 1.5)
					}
				}
			}
		})

		it(`lays out and takes away what is on ${name} only out of sight, past the fog, round every bend`, () => {
			const path = createPath(round)
			for (let distance = 0; distance < 3 * path.round; distance += 3) {
				const here = path.at(distance)
				// Every stretch outside the window, either side of it, for a round and more.
				for (let beyond = 0; beyond < path.round + 500; beyond += 5) {
					for (const outside of [backdropReach.ahead + tileLength + beyond, -backdropReach.behind - tileLength - beyond]) {
						const point = path.at(distance + outside)
						expect(Math.hypot(point.x - here.x, point.z - here.z), `${name} at ${distance} m, ${outside} m along`).toBeGreaterThan(fogFar + farthest)
					}
				}
			}
		})
	}
})
