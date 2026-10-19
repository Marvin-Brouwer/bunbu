/**
 * Which world a stage is run in ([stages](../../../../../docs/design/screens.md#2-fight-setup)): its
 * path, its scenery and the models it loads. Only the stages in `builtStages` can be chosen; any
 * other falls back to castle town.
 */

import type { Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadModel } from '../../canvas/models.mts'
import type { Stage } from '../../_shared/state/selection.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { createBackdrop, type District } from './backdrop.mts'
import { ambushNear, coverSpotsAt, createCover, type CoverSet, type CoverSpot } from './cover.mts'
import { createCastleTown, townDistricts, townCover } from './castle-town.mts'
import type { Owned, StageView } from './landscape.mts'
import { createPath, townRound, type Path } from './path.mts'
import { pictureSettings } from './picture-settings.mts'
import { bambooDistricts, bambooCover, bambooRound, createBambooForest } from './bamboo-forest.mts'
import { castleDistricts, castleCover, castleRound, createEdoCastle } from './edo-castle.mts'
import { createMountainTemple, mountainDistricts, mountainCover, mountainRound } from './mountain-temple.mts'
import { createRiceFields, riceDistricts, riceCover, riceRound } from './rice-fields.mts'

export type StageWorld = {
	readonly path: Path
	readonly view: StageView
	/** Where the covers of the ambush nearest `distance` stand, for its ninjas to run out from behind. */
	readonly covers: (distance: number) => readonly CoverSpot[]
}

/** A stage's own world, before the backdrop and the covers are put round it. */
type OwnWorld = Pick<StageWorld, 'path' | 'view'>

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

/** The models `stage`'s scenery is built from, each one there only if it loaded. */
export function stageModels(stage: Stage) {
	if (stage === 'rice-fields') return loadSome({ maple: 'maple', kit: 'stage-kit' })
	if (stage === 'bamboo-forest' || stage === 'edo-castle') return loadSome({ kit: 'stage-kit', temple: 'temple-kit' })
	if (stage === 'mountain-temple') return loadSome({ temple: 'temple-kit', kit: 'stage-kit' })
	return loadSome({ maple: 'maple', torii: 'torii', bamboo: 'bamboo', kit: 'town-kit' })
}

/**
 * A seed for what is laid out at random, new every run, one for each of the things laid out (`use`).
 * A test's `seed` ([picture settings](./picture-settings.mts)) lays every run out the same, whatever
 * else drew on `Math.random` before (the sound's noise draws as many as its sample rate, which
 * differs between machines), for the stage pictures (`e2e/stage-pictures.spec.mts`).
 */
function newSeed(use: number): number {
	const fixed = pictureSettings().seed
	return fixed !== undefined ? fixed + use * 7919 : Math.floor(Math.random() * 2 ** 31)
}

/**
 * Puts the backdrop of a stage's `districts` behind its own scenery ([backdrop](./backdrop.mts)),
 * district after district along a stage of `stageLength()` metres ([districts](./districts.mts)),
 * and `cover` by its path for the ninjas to hide behind ([cover](./cover.mts)), laid out
 * differently every run.
 */
function around(scene: Scene, { path, view }: OwnWorld, districts: readonly District[], cover: CoverSet, stageLength: () => number, phase: number): StageWorld {
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = createBackdrop(path, districts, newSeed(0), owned, stageLength)
	const covers = createCover(path, cover, metresPerAmbush, newSeed(1), owned, districts, stageLength, phase)
	scene.add(backdrop.group, covers.group)
	return {
		path,
		view: {
			...view,
			follow(x, z, distance) {
				view.follow(x, z, distance)
				backdrop.follow(distance)
				covers.follow(distance)
			},
			dispose() {
				view.dispose()
				backdrop.dispose()
				covers.dispose()
				for (const made of owned.geometries) made.dispose()
				for (const made of owned.materials) made.dispose()
			},
		},
		covers: (distance) => {
			const ambush = ambushNear(distance, metresPerAmbush, phase)
			return coverSpotsAt(path, ambush > 0 ? ambush : ambush + metresPerAmbush, cover.aside)
		},
	}
}

/**
 * Lays out `stage`'s world in `scene`: a path that goes on for as long as the run does, the stage's
 * scenery along it, in blocks stitched together ahead of the samurai ([blocks](./blocks.mts)), and
 * the backdrop behind it, district by district along `stageLength()` metres, and the covers beside it.
 */
export function createStageWorld(stage: Stage, scene: Scene, stageLength: () => number = () => 0, phase = 0): StageWorld {
	if (stage === 'rice-fields') {
		const path = createPath(riceRound)
		return around(scene, { path, view: createRiceFields(scene, path, stageModels(stage)) }, riceDistricts, riceCover, stageLength, phase)
	}
	if (stage === 'bamboo-forest') {
		const path = createPath(bambooRound)
		return around(scene, { path, view: createBambooForest(scene, path, stageModels(stage)) }, bambooDistricts, bambooCover, stageLength, phase)
	}
	if (stage === 'mountain-temple') {
		const path = createPath(mountainRound)
		return around(scene, { path, view: createMountainTemple(scene, path, stageModels(stage)) }, mountainDistricts, mountainCover, stageLength, phase)
	}
	if (stage === 'edo-castle') {
		const path = createPath(castleRound)
		return around(scene, { path, view: createEdoCastle(scene, path, stageModels(stage)) }, castleDistricts, castleCover, stageLength, phase)
	}
	const path = createPath(townRound)
	return around(scene, { path, view: createCastleTown(scene, path, stageModels(stage)) }, townDistricts, townCover, stageLength, phase)
}
