/**
 * Which world a stage is run in ([stages](../../../../../docs/design/screens.md#2-fight-setup)): its
 * path, its scenery and the models it loads. Only the stages in `builtStages` can be chosen; any
 * other falls back to castle town.
 */

import { Vector3, type Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadModel } from '../../canvas/models.mts'
import type { Stage } from '../../_shared/state/selection.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { createBackdrop, type District } from './backdrop.mts'
import { createCover, type Cover, type CoverSet, type CoverSpot } from './cover.mts'
import { createCastleTown, townDistricts, townCover } from './castle-town.mts'
import { nearFade, type Owned, type StageView } from './landscape.mts'
import { createPath, townRound, type Path } from './path.mts'
import { pictureSettings } from './picture-settings.mts'
import type { Solid } from './solids.mts'
import { bambooDistricts, bambooCover, bambooRound, createBambooForest } from './bamboo-forest.mts'
import { castleDistricts, castleCover, castleRound, createEdoCastle } from './edo-castle.mts'
import { createMountainTemple, mountainDistricts, mountainCover, mountainRound } from './mountain-temple.mts'
import { createRiceFields, riceDistricts, riceCover, riceRound } from './rice-fields.mts'

export type StageWorld = {
	readonly path: Path
	readonly view: StageView
	/** Where the covers of the ambush nearest `distance` stand, for its ninjas to run out from behind. */
	readonly covers: (distance: number) => readonly CoverSpot[]
	/** What is solid round the samurai `distance` metres along, the covers too, for the ninjas to run around ([solids](./solids.mts)). */
	readonly solids: (distance: number) => readonly Solid[]
}

/** Metres along the path either side of the samurai that the covers count as solid for the ninjas, and how far round each it is. */
const coverRange = 50
const coverFootprint = 0.9

/** A stage's own scenery along its path, which may make way for the covers put beside it. */
type OwnView = (cover: Cover) => StageView

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
 * differently every run: where the stage `keepsClear`, clear of what is solid in its scenery. What goes over the way, torii and gatehouses, fades as the camera passes
 * under it ([`fadeNear`](./landscape.mts)), on every stage alike.
 */
function around(scene: Scene, path: Path, ownView: OwnView, districts: readonly District[], cover: CoverSet, stageLength: () => number, phase: number, keepsClear = false): StageWorld {
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = createBackdrop(path, districts, newSeed(0), owned, stageLength)
	// The scenery is made after the covers, which it may make way for, and is only asked once it is laid.
	let scenery: StageView | undefined
	const covers = createCover(path, cover, metresPerAmbush, newSeed(1), owned, districts, stageLength, phase, keepsClear ? () => scenery?.solids?.() ?? [] : undefined)
	const view = ownView(covers)
	scenery = view
	scene.add(backdrop.group, covers.group)
	const samurai = new Vector3()
	return {
		path,
		view: {
			...view,
			frame(camera, x, z) {
				nearFade.value = -samurai.set(x, 1, z).applyMatrix4(camera.matrixWorldInverse).z
			},
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
		covers: (distance) => covers.ambushAt(distance),
		solids: (distance) => [
			...view.solids?.() ?? [],
			...covers.spotsBetween(distance - coverRange, distance + coverRange).map((spot) => ({ ...spot, radius: coverFootprint })),
		],
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
		return around(scene, path, () => createRiceFields(scene, path, stageModels(stage)), riceDistricts, riceCover, stageLength, phase)
	}
	if (stage === 'bamboo-forest') {
		const path = createPath(bambooRound)
		return around(scene, path, (covers) => createBambooForest(scene, path, stageModels(stage), covers), bambooDistricts, bambooCover, stageLength, phase)
	}
	if (stage === 'mountain-temple') {
		const path = createPath(mountainRound)
		return around(scene, path, () => createMountainTemple(scene, path, stageModels(stage)), mountainDistricts, mountainCover, stageLength, phase)
	}
	if (stage === 'edo-castle') {
		const path = createPath(castleRound)
		return around(scene, path, () => createEdoCastle(scene, path, stageModels(stage), stageLength), castleDistricts, castleCover, stageLength, phase, true)
	}
	const path = createPath(townRound)
	return around(scene, path, () => createCastleTown(scene, path, stageModels(stage)), townDistricts, townCover, stageLength, phase)
}
