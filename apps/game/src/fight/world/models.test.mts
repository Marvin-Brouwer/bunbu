/**
 * The shipped models against what the world looks up in them by name. three.js drops the `.` from a
 * node's name when it loads it (`UpperArm.L` becomes `UpperArmL`), so the names are compared the
 * way the loaded scene has them.
 */

import { readFileSync } from 'node:fs'
import { PropertyBinding } from 'three'
import { describe, expect, it } from 'vitest'

/** The node names in a `.glb` file under `public/models/`, as three.js names them once loaded. */
function nodeNames(file: string): Set<string> {
	const data = readFileSync(new URL(`../../../public/models/${file}`, import.meta.url))
	const length = data.readUInt32LE(12)
	const json = JSON.parse(data.subarray(20, 20 + length).toString()) as { nodes?: { name?: string }[] }
	return new Set((json.nodes ?? []).map((node) => PropertyBinding.sanitizeNodeName(node.name ?? '')))
}

const limbs = ['L', 'R'].flatMap((side) => ['UpperArm', 'LowerArm', 'UpperLeg', 'LowerLeg'].map((bone) => `${bone}${side}`))

describe('models', () => {
	it('has every bone the samurai\'s armour hangs on', () => {
		const names = nodeNames('samurai.glb')
		for (const bone of ['Head', 'Torso', 'Hips', ...limbs]) expect(names).toContain(bone)
	})

	it('has every piece of the temple kit the title looks up', () => {
		const names = nodeNames('temple-kit.glb')
		for (const piece of ['Hall', 'Pagoda', 'StoneLantern', 'Torii']) expect(names).toContain(piece)
	})

	it('has every part of the town kit castle town reshapes its houses with', () => {
		const names = nodeNames('town-kit.glb')
		for (const part of ['GableRoof', 'PentRoof', 'Lantern', 'Barrel']) expect(names).toContain(part)
	})

	it('has a head on every figure, for its marker', () => {
		for (const file of ['samurai.glb', 'ninja.glb']) expect(nodeNames(file)).toContain('Head')
	})
})
