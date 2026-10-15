/**
 * Which world a stage is run in ([stages](../../../../../docs/design/screens.md#2-fight-setup)): its
 * path, its scenery and the models it loads. Only the stages in `builtStages` can be chosen; any
 * other falls back to castle town.
 */

import type { Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadModel } from '../../canvas/models.mts'
import type { Stage } from '../../_shared/state/selection.mts'
import { createCastleTown } from './castle-town.mts'
import type { StageView } from './landscape.mts'
import { createPath, townRound, type Path } from './path.mts'
import { bambooRound, createBambooForest } from './bamboo-forest.mts'
import { castleRound, createEdoCastle } from './edo-castle.mts'
import { createMountainTemple, mountainRound } from './mountain-temple.mts'
import { createRiceFields, riceRound } from './rice-fields.mts'

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
 * Lays out `stage`'s world in `scene`: a path that goes on for as long as the run does, and the
 * stage's scenery along it, in blocks stitched together ahead of the samurai ([blocks](./blocks.mts)).
 */
export function createStageWorld(stage: Stage, scene: Scene): StageWorld {
	if (stage === 'rice-fields') {
		const path = createPath(riceRound)
		return { path, view: createRiceFields(scene, path, loadSome({ maple: 'maple', kit: 'stage-kit' })) }
	}
	if (stage === 'bamboo-forest') {
		const path = createPath(bambooRound)
		return { path, view: createBambooForest(scene, path, loadSome({ kit: 'stage-kit', temple: 'temple-kit' })) }
	}
	if (stage === 'mountain-temple') {
		const path = createPath(mountainRound)
		return { path, view: createMountainTemple(scene, path, loadSome({ temple: 'temple-kit', kit: 'stage-kit' })) }
	}
	if (stage === 'edo-castle') {
		const path = createPath(castleRound)
		return { path, view: createEdoCastle(scene, path, loadSome({ kit: 'stage-kit', temple: 'temple-kit' })) }
	}
	const path = createPath(townRound)
	return { path, view: createCastleTown(scene, path, loadSome({ maple: 'maple', torii: 'torii', bamboo: 'bamboo', kit: 'town-kit' })) }
}
