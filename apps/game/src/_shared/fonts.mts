/**
 * The one font the game brings along: a brush face for lettering such as the swipe hint (latin
 * only, bundled, so it works offline). Every other font is the player's own.
 *
 * Rooted's CSS loader leaves `url()` in a stylesheet as it is, so the face is added here, where
 * Vite bundles the file. The CSS names it as `--font-brush`, with a fallback for while it loads.
 */

import kaushanScript from '@fontsource/kaushan-script/files/kaushan-script-latin-400-normal.woff2?url'

export function addFonts(): void {
	document.fonts.add(new FontFace('Kaushan Script', `url(${kaushanScript}) format('woff2')`, { display: 'swap' }))
}
