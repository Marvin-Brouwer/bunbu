/**
 * Loading the 3D models in `public/models/` ([assets](../../../../docs/design/assets.md)). Each
 * file is fetched and parsed once and shared; a world clones what it needs from it.
 *
 * Loading is the one thing in the canvas that takes time, so callers get a promise and show a
 * stand-in until it resolves.
 *
 * The files are compressed ([web pipeline](../../../../docs/design/assets.md#web-pipeline)):
 * meshopt geometry, decoded here, and WebP textures, which the browser decodes itself.
 */

import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const loaded = new Map<string, Promise<GLTF>>()

/** The model `name`, from `public/models/<name>.glb`. */
export function loadModel(name: string): Promise<GLTF> {
	let model = loaded.get(name)
	if (model === undefined) {
		model = loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)
		// A failed load can be tried again, by the next world that asks.
		model.catch(() => loaded.delete(name))
		loaded.set(name, model)
	}
	return model
}
