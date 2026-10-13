// Loaded at the top of the service worker (`workerScripts` in vite.config.mts), so a classic script.
//
// On Android, a quiz file shared to the installed app arrives as a POST to `quizzes/shared` (the
// manifest's `share_target`). There is no server to take it, so the worker keeps the files in a cache
// and sends the player on to the quizzes screen, which loads them like a chosen file
// (src/quizzes/opened-quizzes.mts reads this cache).

/// <reference lib="webworker" />

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self))

const sharedQuizzesCache = 'shared-quizzes'
const sharedUrl = new URL('quizzes/shared', worker.registration.scope)
const quizzesUrl = new URL('quizzes/', worker.registration.scope)

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function keepSharedQuizzes(request) {
	const form = await request.formData()
	const files = form.getAll('quiz').filter((value) => value instanceof File)
	const cache = await caches.open(sharedQuizzesCache)
	// One after the other, so the cache lists them in the order they were shared.
	const sharedAt = Date.now()
	await files.reduce((kept, file, index) => kept.then(() => cache.put(
		new URL(`shared/${sharedAt}-${index}`, quizzesUrl),
		new Response(file, {
			headers: {
				'Content-Type': file.type === '' ? 'application/octet-stream' : file.type,
				'X-File-Name': encodeURIComponent(file.name),
			},
		}),
	)), Promise.resolve())
	return Response.redirect(quizzesUrl.href, 303)
}

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'POST') return
	if (new URL(event.request.url).pathname !== sharedUrl.pathname) return
	event.respondWith(keepSharedQuizzes(event.request))
})
