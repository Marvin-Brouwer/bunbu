/**
 * Where an ambush shows the ninjas closing in on a phone in portrait, where the scroll covers the
 * whole width ([time limit](../../../../docs/design/gameplay.md#time-limit)). Plain numbers, so it
 * can be tested; the run screen lays the scroll out by it and the world frames the fight by it.
 *
 * When the screen is tall enough, the scroll stops short of the bottom and the camera frames the
 * fight in the room below it. When it isn't, the scroll goes down to the bottom and a low strip
 * above it shows the samurai and a ninja walking toward each other instead. Wider than the scroll,
 * the world shows beside it and needs neither.
 */

export type AmbushRoom = {
	/** CSS pixels kept free below the scroll for the fight, `0` when there is no room. */
	readonly below: number
	/** CSS pixels the duel strip takes above the scroll, `0` when it doesn't show. */
	readonly strip: number
}

/** In rem. To tune in playtests. */
export const ambushRoomConfig = {
	/** The scroll's widest, with the scroll layer's padding either side: wider than this, the world shows beside it. */
	scrollWidth: 35.5,
	/** The HUD's top row the scroll stays clear of, and its own margin at the bottom. */
	scrollTop: 3.5,
	scrollBottom: 0.5,
	/** The scroll keeps at least this much height, so a question still reads well. */
	minimumScroll: 30,
	/** Less room than this below the scroll is too small to see the fight in. */
	minimumBelow: 9,
	/** The room below never takes more than this share of the screen. */
	largestBelow: 0.26,
	/** The duel strip's height, with room at its top for the score box's line with the best score. */
	strip: 3.5,
}

export const noRoom: AmbushRoom = { below: 0, strip: 0 }

export function ambushRoomOf(width: number, height: number, rem = 16, config = ambushRoomConfig): AmbushRoom {
	if (width <= 0 || height <= 0 || width > config.scrollWidth * rem) return noRoom
	const spare = height - (config.scrollTop + config.scrollBottom + config.minimumScroll) * rem
	const below = Math.min(spare, height * config.largestBelow)
	if (below >= config.minimumBelow * rem) return { below: Math.floor(below), strip: 0 }
	return { below: 0, strip: config.strip * rem }
}
