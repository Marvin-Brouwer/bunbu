/**
 * How a run is set up for taking pictures of it, as the stage pictures do
 * (`e2e/stage-pictures.spec.mts`). A test sets these by putting `window.pictureSettings` on the page
 * before it loads. Only a build with `VITE_PICTURE_SETTINGS=on` reads them, as the e2e tests' dev
 * server is; the deployed game is built without it, so the code isn't in it at all.
 */

export type PictureSettings = {
	/** Leaves the samurai and the ninjas out, for a picture of the stage alone. */
	readonly scenery?: boolean
	/** Lays every run out the same, whatever else drew on `Math.random` before. */
	readonly seed?: number
}

declare global {
	interface Window {
		/** Only set by a test. */
		readonly pictureSettings?: () => PictureSettings
	}
}

/** The settings a test put on the page, or none. */
export const pictureSettings = (): PictureSettings =>
	(import.meta.env.VITE_PICTURE_SETTINGS === 'on' ? window.pictureSettings?.() : undefined) ?? {}
