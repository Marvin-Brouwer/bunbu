/**
 * The picture Share sends: the quiz's title over the top of the results, the header with the score
 * and the three tiles under it, drawn on a canvas in the scroll's colours, with Bunbu's name and
 * link at the foot to dare a friend to beat it.
 */

import { appLink } from '../../_shared/app-link.mts'

export type ScoreTile = {
	readonly label: string
	readonly value: string
	readonly note: string
}

export type ScorePicture = {
	readonly quizTitle: string
	readonly verdict: string
	readonly points: string
	/** The high score beside the points: `was 2,210` or `best 2,210`. */
	readonly was: string | undefined
	readonly summary: string
	readonly tiles: readonly ScoreTile[]
}

/** Drawn in CSS pixels, at three device pixels each: 1080 pixels wide, sharp on any phone. */
const width = 360
const scale = 3
const padding = 20
const gap = 10

/** The game's own colours and fonts, as `source` has them: the theme is set on the app's container. */
const looksOf = (source: Element) => {
	const style = getComputedStyle(source)
	const token = (name: string) => style.getPropertyValue(name).trim()
	return {
		paper: token('--paper'),
		paperLight: token('--paper-light'),
		ink: token('--ink'),
		inkSoft: token('--ink-soft'),
		vermilion: token('--vermilion'),
		body: token('--font-body'),
		mono: token('--font-mono'),
		display: token('--font-display'),
	}
}

/** Splits `text` into lines no wider than `maxWidth`, at spaces. */
const linesOf = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
	const lines: string[] = []
	let line = ''
	for (const word of text.split(' ')) {
		const longer = line === '' ? word : `${line} ${word}`
		if (line !== '' && context.measureText(longer).width > maxWidth) {
			lines.push(line)
			line = word
		} else {
			line = longer
		}
	}
	lines.push(line)
	return lines
}

/** A framed box, like a tile on the scroll. */
const box = (context: CanvasRenderingContext2D, x: number, y: number, boxWidth: number, boxHeight: number, fill: string, stroke: string) => {
	context.beginPath()
	context.roundRect(x + 1, y + 1, boxWidth - 2, boxHeight - 2, 3)
	context.fillStyle = fill
	context.fill()
	context.lineWidth = 2
	context.strokeStyle = stroke
	context.stroke()
}

/** Draws the picture once to measure it, then for real on a canvas of that height. */
const draw = (context: CanvasRenderingContext2D, picture: ScorePicture, look: ReturnType<typeof looksOf>): number => {
	const inner = width - padding * 2
	context.textBaseline = 'top'
	let y = padding

	// The quiz, so a friend knows what to beat.
	context.fillStyle = look.inkSoft
	context.font = `12px ${look.mono}`
	context.fillText('QUIZ', padding, y)
	y += 18
	context.fillStyle = look.ink
	context.font = `700 22px ${look.body}`
	for (const line of linesOf(context, picture.quizTitle, inner)) {
		context.fillText(line, padding, y)
		y += 27
	}
	y += gap

	// The header: the seal, the verdict, the points and the summary.
	const seal = 58
	const headlineX = padding + 16 + seal + 16
	const headlineWidth = width - padding - 16 - headlineX
	context.font = `13px ${look.mono}`
	const summary = linesOf(context, picture.summary, headlineWidth)
	const headerHeight = Math.max(seal, 16 + 4 + 36 + summary.length * 17) + 32
	box(context, padding, y, inner, headerHeight, look.paperLight, look.vermilion)
	const sealX = padding + 16 + seal / 2
	const sealY = y + headerHeight / 2
	context.beginPath()
	context.arc(sealX, sealY, seal / 2 - 1.5, 0, Math.PI * 2)
	context.lineWidth = 3
	context.strokeStyle = look.vermilion
	context.stroke()
	context.fillStyle = look.vermilion
	context.font = `700 30px ${look.display}`
	context.textAlign = 'center'
	context.textBaseline = 'middle'
	context.fillText('勝', sealX, sealY)
	context.textAlign = 'start'
	context.textBaseline = 'top'
	let headlineY = y + 16
	context.font = `700 13px ${look.mono}`
	context.fillText(picture.verdict.toUpperCase(), headlineX, headlineY)
	headlineY += 20
	context.fillStyle = look.ink
	context.font = `700 32px ${look.body}`
	context.fillText(picture.points, headlineX, headlineY)
	if (picture.was !== undefined) {
		const pointsWidth = context.measureText(picture.points).width
		context.fillStyle = look.inkSoft
		context.font = `14px ${look.mono}`
		context.fillText(picture.was, headlineX + pointsWidth + 7, headlineY + 14)
	}
	headlineY += 40
	context.fillStyle = look.inkSoft
	context.font = `13px ${look.mono}`
	for (const line of summary) {
		context.fillText(line, headlineX, headlineY)
		headlineY += 17
	}
	y += headerHeight + gap

	// The three tiles, as tall as the tallest.
	const tileWidth = (inner - gap * (picture.tiles.length - 1)) / picture.tiles.length
	context.font = `11px ${look.mono}`
	const notes = picture.tiles.map((tile) => linesOf(context, tile.note, tileWidth - 20))
	const tileHeight = 10 + 16 + 26 + Math.max(...notes.map((lines) => lines.length)) * 14 + 10
	picture.tiles.forEach((tile, index) => {
		const x = padding + index * (tileWidth + gap)
		box(context, x, y, tileWidth, tileHeight, look.paperLight, look.ink)
		context.fillStyle = look.inkSoft
		context.font = `12px ${look.mono}`
		context.fillText(tile.label.toUpperCase(), x + 10, y + 10)
		context.fillStyle = look.ink
		context.font = `700 21px ${look.body}`
		context.fillText(tile.value, x + 10, y + 26)
		context.fillStyle = look.inkSoft
		context.font = `11px ${look.mono}`
		notes[index]?.forEach((line, row) => {
			context.fillText(line, x + 10, y + 52 + row * 14)
		})
	})
	y += tileHeight + gap + 4

	// Where to play it.
	context.fillStyle = look.ink
	context.font = `700 15px ${look.display}`
	context.fillText('Bunbu: Shogun Scholar', padding, y)
	y += 20
	context.fillStyle = look.inkSoft
	context.font = `12px ${look.mono}`
	context.fillText(appLink().replace(/^https?:\/\//, ''), padding, y)
	return y + 16 + padding
}

/** The picture as a PNG file, in the colours and fonts `source` sits in. */
export async function scorePictureOf(picture: ScorePicture, name: string, source: Element): Promise<File> {
	const look = looksOf(source)
	const measuring = document.createElement('canvas').getContext('2d')
	if (measuring === null) throw new Error('no 2D canvas')
	const height = draw(measuring, picture, look)

	const canvas = document.createElement('canvas')
	canvas.width = width * scale
	canvas.height = Math.ceil(height * scale)
	const context = canvas.getContext('2d')
	if (context === null) throw new Error('no 2D canvas')
	context.scale(scale, scale)
	context.fillStyle = look.paper
	context.fillRect(0, 0, width, height)
	draw(context, picture, look)

	const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, 'image/png') })
	if (blob === null) throw new Error('the canvas made no picture')
	return new File([blob], name, {
		type: 'image/png',
	})
}
