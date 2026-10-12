/**
 * A quiz as a `.bunbu` file ([sharing](../../../../../docs/design/data-format.md#sharing)), to
 * share or download: the one the library keeps, or packed on the spot for a quiz it doesn't have,
 * such as the dev fixture.
 */

import { compress, fileExtension, mimeType, type BunbuData } from '@bunbu/data'
import { snapshot } from '../state/store.mts'
import { library, type LibraryActions, type LibraryState } from '../storage/library.mts'

/** The quiz's file, named after its `id`. Packing can fail, so this can reject. */
export async function quizFileOf(quiz: BunbuData): Promise<File> {
	const kept = snapshot<LibraryState & LibraryActions>(library).entries.find((entry) => entry.quiz.id === quiz.id && entry.quiz.version === quiz.version)
	// A copy on its own ArrayBuffer, which is what a File takes.
	const bytes = new Uint8Array(kept?.file.value ?? await compress(quiz))
	return new File([bytes], `${quiz.id}${fileExtension}`, {
		type: mimeType,
	})
}

/** Saves a file to the player's downloads. */
export function download(file: File): void {
	const url = URL.createObjectURL(file)
	const link = document.createElement('a')
	link.href = url
	link.download = file.name
	link.click()
	// Revoked a moment later: Firefox and Safari can lose the download when it goes right away.
	setTimeout(() => {
		URL.revokeObjectURL(url)
	}, 0)
}
