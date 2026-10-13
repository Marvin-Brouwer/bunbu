/**
 * Quiz files that come in from outside the app, to load like a chosen file:
 * - opened with the installed app, on desktop Chrome and Edge (the manifest's `file_handlers`, which
 *   hands them over through `launchQueue`);
 * - shared to the installed app, on Android (the manifest's `share_target`, which the service worker
 *   takes and keeps in a cache, public/receive-shared-quizzes.js).
 * Safari and Firefox do neither, so there the Load quiz button is the only way in.
 */

/** What the browser hands over when the installed app opens files ([File Handling](https://wicg.github.io/manifest-incubations/#launch-queue-and-launch-params)). */
type LaunchParams = {
	readonly files: readonly FileSystemHandle[]
}

type LaunchQueue = {
	setConsumer(consumer: (params: LaunchParams) => void): void
}

declare global {
	interface Window {
		/** Only in browsers that let an installed app open files. */
		readonly launchQueue?: LaunchQueue
	}
}

/** The same name as in the service worker script. */
const sharedQuizzesCache = 'shared-quizzes'

const isFile = (handle: FileSystemHandle): handle is FileSystemFileHandle => handle.kind === 'file'

/** Hands the files the installed app was opened with to `read`, now and on every later launch. */
export function receiveOpenedQuizzes(read: (files: readonly File[]) => Promise<void>): void {
	window.launchQueue?.setConsumer((params) => {
		if (params.files.length === 0) return
		void Promise.all(params.files.filter(isFile).map((handle) => handle.getFile())).then(read)
	})
}

/** The quiz files shared to the installed app, taken out of the service worker's cache. */
export async function takeSharedQuizzes(): Promise<File[]> {
	if (!('caches' in window)) return []
	const cache = await caches.open(sharedQuizzesCache)
	const shared = await cache.keys()
	const files = await Promise.all(shared.map(async (request) => {
		const response = await cache.match(request)
		await cache.delete(request)
		if (response === undefined) return []
		const name = decodeURIComponent(response.headers.get('X-File-Name') ?? '')
		return [new File([await response.blob()], name, { type: response.headers.get('Content-Type') ?? '' })]
	}))
	return files.flat()
}
