/**
 * The title screen's world ([1 Title](../../../../docs/design/screens.md#1-title--menu)): the
 * samurai idling under a torii at dusk, with petals falling. He stands in the gap between the name
 * at the top and the menu at the bottom ([framing](./framing.mts)).
 *
 * Like the run, it shows placeholders until the models have loaded, each on its own.
 */

import {
	ACESFilmicToneMapping,
	BackSide,
	Box3,
	BoxGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type Material,
	type Object3D,
	type Texture,
} from 'three'
import { loadModel } from '../canvas/models.mts'
import type { View } from '../canvas/stage.mts'
import type { Viewport } from '../canvas/viewport.mts'
import { createCharacter, placeholderBody, samuraiLook, type Body } from '../_shared/world/character.mts'
import { createFigureParts } from '../_shared/world/figure.mts'
import { createPetals } from '../_shared/world/petals.mts'
import { titleFraming, titleShot, type Gap } from './framing.mts'
import { createScenery, type Owned } from './scenery.mts'

const palette = {
	skyTop: 0x161a3a,
	skyHorizon: 0xd9805a,
	/** The haze the far mountains melt into: close to the sky at the horizon. */
	fog: 0xb87468,
	ground: 0x3e352f,
	moss: 0x4a5a32,
	blossom: 0xffb3c8,
}

/** Where the cherry trees stand, either side of the path: x, z, turn and size. */
const cherries: readonly (readonly [x: number, z: number, turn: number, size: number])[] = [
	[-5, -10, 0.4, 6],
	[6, -16, 2.1, 6.5],
	[-7, -34, 3.2, 7.5],
	[8, -46, 0.9, 7.5],
]

/** Metres the torii stands behind the samurai, and how tall it is. */
const toriiBehind = 2.6
const toriiHeight = 5.2

function skyDome(): Mesh {
	const geometry = new SphereGeometry(420, 32, 16)
	const material = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new Color(palette.skyTop) },
			horizon: { value: new Color(palette.skyHorizon) },
		},
		vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPosition; void main() { float h = clamp(normalize(vPosition).y * 2.0, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, h), 1.0);\n#include <colorspace_fragment>\n}',
	})
	const mesh = new Mesh(geometry, material)
	mesh.renderOrder = -10
	return mesh
}

/**
 * The maple's leaves as blossom: the texture's colour taken out, its shape and light kept, so a pink
 * colour on the material shows pink rather than red.
 */
function blossomOf(map: Texture): CanvasTexture | undefined {
	const image = map.image as CanvasImageSource & { readonly width: number; readonly height: number } | undefined
	if (image === undefined || image.width === 0) return undefined
	const canvas = document.createElement('canvas')
	canvas.width = image.width
	canvas.height = image.height
	const context = canvas.getContext('2d')
	if (context === null) return undefined
	context.drawImage(image, 0, 0)
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
	const { data } = pixels
	for (let index = 0; index < data.length; index += 4) {
		const light = Math.max(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)
		data[index] = light
		data[index + 1] = light
		data[index + 2] = light
	}
	context.putImageData(pixels, 0, 0)
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = map.colorSpace
	texture.flipY = map.flipY
	texture.wrapS = map.wrapS
	texture.wrapT = map.wrapT
	return texture
}

/** A torii from boxes, the model's size: two posts, the curved top beam as a flat one, and the tie beam. */
function toriiPlaceholder(owned: Owned): Group {
	const gate = new Group()
	const geometry = new BoxGeometry(1, 1, 1)
	const lacquer = new MeshStandardMaterial({ color: 0xa8261c, roughness: 0.6 })
	const black = new MeshStandardMaterial({ color: 0x1f1c18, roughness: 0.7 })
	owned.geometries.push(geometry)
	owned.materials.push(lacquer, black)
	const piece = (material: Material, x: number, y: number, sx: number, sy: number, sz: number) => {
		const mesh = new Mesh(geometry, material)
		mesh.position.set(x, y, 0)
		mesh.scale.set(sx, sy, sz)
		mesh.castShadow = true
		gate.add(mesh)
	}
	for (const side of [-1, 1]) piece(lacquer, side * 1.7, 2.3, 0.35, 4.6, 0.35)
	piece(lacquer, 0, 3.75, 4.4, 0.3, 0.3)
	piece(lacquer, 0, 4.8, 5.6, 0.35, 0.45)
	piece(black, 0, 5.1, 6, 0.25, 0.5)
	return gate
}

/** `model` scaled to `height` metres, standing on the ground and centred. */
function standing(model: Object3D, height: number): Group {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	const centre = bounds.getCenter(new Vector3())
	const scale = height / Math.max(bounds.max.y - bounds.min.y, 1e-3)
	const holder = new Group()
	holder.add(model)
	// From wherever it sat in its file: the bounds include its own position.
	model.position.sub(new Vector3(centre.x, bounds.min.y, centre.z))
	holder.scale.setScalar(scale)
	return holder
}

/** `gap` is where the name and the menu leave the screen free for the samurai. */
export function createTitleWorld(viewport: Viewport, gap: () => Gap): View {
	const { renderer, camera } = viewport
	const scene = new Scene()
	scene.fog = new Fog(palette.fog, 40, 380)
	const sky = skyDome()
	scene.add(sky)
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const scenery = createScenery(owned)
	scene.add(scenery.group)

	scene.add(new HemisphereLight(0xb0b4e0, 0x4a3a30, 2.2))
	const sun = new DirectionalLight(0xffb27a, 2.6)
	sun.position.set(-6, 9, 5)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) sun.shadow.camera[side] = -6
	for (const side of ['right', 'top'] as const) sun.shadow.camera[side] = 6
	sun.shadow.bias = -0.0008
	scene.add(sun)

	const groundGeometry = new CircleGeometry(300, 40).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)
	// Moss either side of the path, up to the temple.
	const mossGeometry = new CircleGeometry(1, 24).rotateX(-Math.PI / 2)
	const mossMaterial = new MeshStandardMaterial({ color: palette.moss, roughness: 1 })
	owned.geometries.push(mossGeometry)
	owned.materials.push(mossMaterial)
	const moss = new Mesh(mossGeometry, mossMaterial)
	// Up to under the camera, however far back it stands for a short screen, so no bare earth shows at the foot.
	moss.position.set(0, 0.01, -30)
	moss.scale.set(42, 1, 74)
	moss.receiveShadow = true
	scene.add(moss)

	const parts = createFigureParts()
	let samurai: Body = placeholderBody(parts, { body: 0x7a2a22, skin: 0xe2c4a0, band: 0x1f1c18, blade: 0xdfe3ea })
	scene.add(samurai.root)
	// Turned a little toward the light, so he reads as a figure rather than a silhouette.
	const facing = Math.PI - 0.35

	const petals = createPetals(120, { width: 14, height: 8, depth: 10 })
	scene.add(petals.mesh)

	let disposed = false
	const torii = new Group()
	torii.position.z = -toriiBehind
	scene.add(torii)
	// A plain red gate stands in until the model is in, and stays if it never comes.
	const placeholderGate = toriiPlaceholder(owned)
	torii.add(placeholderGate)
	// The temple kit (`assets/blender/temple_kit.py`): the gate, and the buildings the scenery stands in for.
	void loadModel('temple-kit').then((model) => {
		if (disposed) return
		scenery.useKit(model.scene)
		const kitGate = model.scene.getObjectByName('Torii')
		if (kitGate === undefined) throw new Error('the temple kit has no torii')
		torii.remove(placeholderGate)
		const gate = standing(kitGate.clone(), toriiHeight)
		gate.traverse((object) => {
			if (object instanceof Mesh) object.castShadow = true
		})
		torii.add(gate)
	}).catch((error: unknown) => {
		console.warn('[bunbu] the temple kit did not load; the placeholder gate and buildings stay', error)
	})
	// Cherry trees: the maples with their leaves in blossom. Their own materials, so the shared model keeps its colours.
	const grove = new Group()
	scene.add(grove)
	void loadModel('maple').then((model) => {
		if (disposed) return
		const variants: Object3D[] = []
		model.scene.traverse((object) => {
			if (/^MapleTree_\d+$/.test(object.name) && !variants.some((found) => /^MapleTree_\d+$/.test(found.name) && found === object.parent)) variants.push(object)
		})
		const blossom = new Map<Material, Material>()
		cherries.forEach(([x, z, turn, size], index) => {
			const variant = variants[index % Math.max(variants.length, 1)] ?? model.scene
			const tree = standing(variant.clone(), size)
			tree.traverse((object) => {
				if (!(object instanceof Mesh)) return
				object.castShadow = true
				const source = object.material as Material
				let own = blossom.get(source)
				if (own === undefined) {
					own = source.clone()
					if (own instanceof MeshStandardMaterial && /leaves/i.test(own.name)) {
						const blossomMap = own.map === null ? undefined : blossomOf(own.map)
						if (blossomMap !== undefined) {
							own.map = blossomMap
							owned.textures.push(blossomMap)
						}
						own.color.setHex(palette.blossom)
						// A cut-out, not blended, so the leaves sort right ([premultiplied alpha](../../../../docs/architecture/rendering.md#premultiplied-alpha-caveat)).
						own.transparent = false
						own.alphaTest = 0.5
					}
					blossom.set(source, own)
					owned.materials.push(own)
				}
				object.material = own
			})
			tree.position.set(x, 0, z)
			tree.rotation.y = turn
			grove.add(tree)
		})
	}).catch((error: unknown) => {
		console.warn('[bunbu] the cherry trees did not load; the path stands bare', error)
	})
	void loadModel('samurai').then((model) => {
		if (disposed) return
		scene.remove(samurai.root)
		samurai.dispose()
		samurai = createCharacter(model, samuraiLook)
		scene.add(samurai.root)
	}).catch((error: unknown) => {
		console.warn('[bunbu] the samurai model did not load; the placeholder stays', error)
	})

	const before = {
		fov: camera.fov,
		far: camera.far,
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
		shadows: renderer.shadowMap.enabled,
		toneMapping: renderer.toneMapping,
		exposure: renderer.toneMappingExposure,
	}
	camera.fov = titleFraming.fov
	camera.far = 700
	camera.updateProjectionMatrix()
	renderer.shadowMap.enabled = true
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.1

	let time = 0

	return {
		scene,

		draw(delta) {
			time += delta
			samurai.show('idle', time, 0)
			samurai.root.rotation.y = facing

			// A slow breath of the camera from side to side, so the still scene is alive.
			const { clientWidth: width, clientHeight: height } = renderer.domElement
			if (width === 0 || height === 0) return
			const shot = titleShot(width, height, gap(), Math.sin(time * 0.15) * 0.035)
			camera.position.set(...shot.position)
			camera.lookAt(...shot.look)
			if (shot.shift === 0) camera.clearViewOffset()
			else camera.setViewOffset(width, height, 0, shot.shift, width, height)
			camera.updateProjectionMatrix()

			petals.draw(delta, { x: 0, z: 0 })
			scenery.draw(time)
		},

		dispose() {
			disposed = true
			samurai.dispose()
			parts.dispose()
			petals.dispose()
			groundGeometry.dispose()
			scenery.dispose()
			for (const made of owned.geometries) made.dispose()
			for (const made of owned.materials) made.dispose()
			for (const made of owned.textures) made.dispose()
			groundMaterial.dispose()
			sky.geometry.dispose()
			;(sky.material as ShaderMaterial).dispose()
			sun.dispose()
			scene.clear()
			camera.fov = before.fov
			camera.far = before.far
			camera.clearViewOffset()
			camera.position.copy(before.position)
			camera.quaternion.copy(before.quaternion)
			camera.updateProjectionMatrix()
			renderer.shadowMap.enabled = before.shadows
			renderer.toneMapping = before.toneMapping
			renderer.toneMappingExposure = before.exposure
		},
	}
}
