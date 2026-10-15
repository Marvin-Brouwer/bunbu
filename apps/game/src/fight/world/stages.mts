/**
 * Which world a stage is run in ([stages](../../../../../docs/design/screens.md#2-fight-setup)): its
 * path, its scenery and the models it loads. Only the stages in `builtStages` can be chosen; any
 * other falls back to castle town.
 */

import type { Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadModel } from '../../canvas/models.mts'
import type { Stage } from '../../_shared/state/selection.mts'
import { createBackdrop, type BackdropRow } from './backdrop.mts'
import { createCastleTown, townBackdrop } from './castle-town.mts'
import type { Owned, StageView } from './landscape.mts'
import { createPath, townRound, type Path } from './path.mts'
import { bambooBackdrop, bambooRound, createBambooForest } from './bamboo-forest.mts'
import { castleBackdrop, castleRound, createEdoCastle } from './edo-castle.mts'
import { createMountainTemple, mountainBackdrop, mountainRound } from './mountain-temple.mts'
import { createRiceFields, riceBackdrop, riceRound } from './rice-fields.mts'

export type StageWorld = {
	readonly path: Path
	readonly view: StageView
}

/** The models `names`, each one there only if it loaded: a stage stands without the ones that fail. */
function loadSome<Name extends string>(names: Readonly<Record<Name, string>>): Promise<Partial<Record<Name, GLTF>>> {
	const entries = Object.entries(names) as [Name, string][]
	return Promise.allSettled(entries.map(([, file]) => loadModel(file))).then((results) => {
		const loaded: Partial<Record<Name, GLTF>> = {}
		results.forEach((result, index) => {
			const name = entries[index]?.[0]
			if (name !== undefined && result.status === 'fulfilled') loaded[name] = result.value
		})
		return loaded
	})
}

/**
 * Puts `rows` of backdrop behind a stage's own scenery ([backdrop](./backdrop.mts)), laid out
 * differently every run.
 */
function withBackdrop(scene: Scene, { path, view }: StageWorld, rows: readonly BackdropRow[]): StageWorld {
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = createBackdrop(path, rows, Math.floor(Math.random() * 2 ** 31), owned)
	scene.add(backdrop.group)
	return {
		path,
		view: {
			...view,
			follow(x, z, distance) {
				view.follow(x, z, distance)
				backdrop.follow(distance)
			},
			dispose() {
				view.dispose()
				backdrop.dispose()
				for (const made of owned.geometries) made.dispose()
				for (const made of owned.materials) made.dispose()
			},
		},
	}
}

/**
 * Lays out `stage`'s world in `scene`: a path that goes on for as long as the run does, the stage's
 * scenery along it, in blocks stitched together ahead of the samurai ([blocks](./blocks.mts)), and
 * the backdrop behind it.
 */
export function createStageWorld(stage: Stage, scene: Scene): StageWorld {
	if (stage === 'rice-fields') {
		const path = createPath(riceRound)
		return withBackdrop(scene, { path, view: createRiceFields(scene, path, loadSome({ maple: 'maple', kit: 'stage-kit' })) }, riceBackdrop)
	}
	if (stage === 'bamboo-forest') {
		const path = createPath(bambooRound)
		return withBackdrop(scene, { path, view: createBambooForest(scene, path, loadSome({ kit: 'stage-kit', temple: 'temple-kit' })) }, bambooBackdrop)
	}
	if (stage === 'mountain-temple') {
		const path = createPath(mountainRound)
		return withBackdrop(scene, { path, view: createMountainTemple(scene, path, loadSome({ temple: 'temple-kit', kit: 'stage-kit' })) }, mountainBackdrop)
	}
	if (stage === 'edo-castle') {
		const path = createPath(castleRound)
		return withBackdrop(scene, { path, view: createEdoCastle(scene, path, loadSome({ kit: 'stage-kit', temple: 'temple-kit' })) }, castleBackdrop)
	}
	const path = createPath(townRound)
	return withBackdrop(scene, { path, view: createCastleTown(scene, path, loadSome({ maple: 'maple', torii: 'torii', bamboo: 'bamboo', kit: 'town-kit' })) }, townBackdrop)
}
