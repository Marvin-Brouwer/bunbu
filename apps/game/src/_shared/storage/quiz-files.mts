/**
 * The loaded quizzes' files, kept in IndexedDB as `.bunbu` bytes
 * ([sharing](../../../../../docs/design/data-format.md#sharing)): packed and compressed, so far
 * more of them fit than in local storage, and the same bytes Share sends on.
 *
 * Every record carries the version of its shape, as the values in local storage do
 * (`storage.mts`); a record of another version is skipped. Without IndexedDB, as when the pages
 * are pre-rendered or in a private window that blocks it, nothing is kept and the game plays on.
 */

import { storedVersion } from './storage.mts'

const databaseName = 'bunbu'
const databaseVersion = 1
const storeName = 'quiz-files'

type QuizFileRecord = {
	readonly version: number
	readonly file: Uint8Array
}

/** A request as a promise. */
const settled = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
	request.addEventListener('success', () => { resolve(request.result) })
	request.addEventListener('error', () => { reject(request.error ?? new Error('IndexedDB request failed')) })
})

/** A transaction as a promise, done once everything in it is written. */
const committed = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
	transaction.addEventListener('complete', () => { resolve() })
	transaction.addEventListener('error', () => { reject(transaction.error ?? new Error('IndexedDB transaction failed')) })
	transaction.addEventListener('abort', () => { reject(transaction.error ?? new Error('IndexedDB transaction aborted')) })
})

// One connection per factory, so writes queue up on it in the order they were made. The factory
// is checked because tests swap it for a fresh one.
let connection: { readonly factory: IDBFactory, readonly database: Promise<IDBDatabase> } | undefined

function open(): Promise<IDBDatabase> | undefined {
	if (typeof indexedDB === 'undefined') return undefined
	if (connection?.factory !== indexedDB) {
		const request = indexedDB.open(databaseName, databaseVersion)
		request.addEventListener('upgradeneeded', () => {
			request.result.createObjectStore(storeName)
		})
		connection = { factory: indexedDB, database: settled(request) }
	}
	return connection.database
}

const isRecord = (value: unknown): value is QuizFileRecord =>
	typeof value === 'object' && value !== null
	&& (value as { version?: unknown }).version === storedVersion
	&& (value as { file?: unknown }).file instanceof Uint8Array

/** The kept files in the order they were loaded, or none when IndexedDB fails. Not validated yet. */
export async function readQuizFiles(): Promise<Uint8Array[]> {
	try {
		const database = await open()
		if (database === undefined) return []
		const records = await settled(database.transaction(storeName).objectStore(storeName).getAll())
		return records.filter(isRecord).map((record) => record.file)
	} catch (error) {
		console.warn('[bunbu] could not read the loaded quizzes', error)
		return []
	}
}

/**
 * Keeps exactly these files, replacing what was kept, in one transaction. A failing write is
 * dropped: the game plays on without saving.
 */
export async function writeQuizFiles(files: readonly Uint8Array[]): Promise<void> {
	try {
		const database = await open()
		if (database === undefined) return
		const transaction = database.transaction(storeName, 'readwrite')
		const store = transaction.objectStore(storeName)
		store.clear()
		files.forEach((file, index) => {
			store.put({ version: storedVersion, file } satisfies QuizFileRecord, index)
		})
		await committed(transaction)
	} catch (error) {
		console.warn('[bunbu] could not save the loaded quizzes', error)
	}
}
