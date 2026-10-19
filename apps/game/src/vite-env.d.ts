/// <reference types="vite/client" />
/// <reference types="@rooted/components/types" />
/// <reference types="@rooted/router/types" />
/// <reference types="@rooted/markdown/types" />

interface ImportMetaEnv {
	/** `on` in a build for taking pictures of the game (src/fight/world/picture-settings.mts), never in the deployed one. */
	readonly VITE_PICTURE_SETTINGS?: 'on'
}
