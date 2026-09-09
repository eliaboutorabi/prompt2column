/**
 * Minimal IndexedDB wrapper. Two stores: local accounts and their projects.
 * Everything stays in this browser profile, nothing is uploaded.
 */
import type { Project, ProjectSummary } from './types';

const DB_NAME = 'prompt2column';
const DB_VERSION = 1;
const USERS = 'users';
const PROJECTS = 'projects';

export interface StoredUser {
	id: string;
	username: string;
	/** Base64 PBKDF2 salt. */
	salt: string;
	/** Base64 PBKDF2 verifier. */
	verifier: string;
	iterations: number;
	createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(USERS)) {
				const users = db.createObjectStore(USERS, { keyPath: 'id' });
				users.createIndex('username', 'username', { unique: true });
			}
			if (!db.objectStoreNames.contains(PROJECTS)) {
				const projects = db.createObjectStore(PROJECTS, { keyPath: 'id' });
				projects.createIndex('ownerId', 'ownerId', { unique: false });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error('Could not open the local database.'));
	});
	return dbPromise;
}

function run<T>(
	store: string,
	mode: IDBTransactionMode,
	body: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(store, mode);
				const request = body(tx.objectStore(store));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? new Error('Local database error.'));
			})
	);
}

export async function getUserByName(username: string): Promise<StoredUser | undefined> {
	const key = username.trim().toLowerCase();
	return run<StoredUser | undefined>(USERS, 'readonly', (store) =>
		store.index('username').get(key)
	);
}

export async function putUser(user: StoredUser): Promise<void> {
	await run(USERS, 'readwrite', (store) => store.put(user));
}

export async function getUser(id: string): Promise<StoredUser | undefined> {
	return run<StoredUser | undefined>(USERS, 'readonly', (store) => store.get(id));
}

export async function countUsers(): Promise<number> {
	return run<number>(USERS, 'readonly', (store) => store.count());
}

export async function putProject(project: Project): Promise<void> {
	await run(PROJECTS, 'readwrite', (store) => store.put(project));
}

export async function getProject(id: string): Promise<Project | undefined> {
	return run<Project | undefined>(PROJECTS, 'readonly', (store) => store.get(id));
}

export async function deleteProject(id: string): Promise<void> {
	await run(PROJECTS, 'readwrite', (store) => store.delete(id));
}

export async function listProjects(ownerId: string): Promise<ProjectSummary[]> {
	const projects = await run<Project[]>(PROJECTS, 'readonly', (store) =>
		store.index('ownerId').getAll(ownerId)
	);
	return projects
		.map((project) => ({
			id: project.id,
			ownerId: project.ownerId,
			name: project.name,
			fileName: project.fileName,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			rowCount: project.rows.length,
			columnCount: project.columns.length
		}))
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Test hook: forces the next call to reopen the database. */
export function resetConnection(): void {
	dbPromise = null;
}
