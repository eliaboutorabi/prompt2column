/**
 * Local accounts. Passwords never leave the machine: PBKDF2-SHA256 derives a
 * verifier that is compared on sign-in. This separates projects per person on a
 * shared computer. It is not server authentication and the project data itself
 * is stored unencrypted in IndexedDB.
 */
import { countUsers, getUser, getUserByName, putUser, type StoredUser } from './db';
import { uid } from './types';

const ITERATIONS = 210_000;
const SESSION_KEY = 'prompt2column:session';

export interface Account {
	id: string;
	username: string;
}

function toBase64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(text: string): Uint8Array {
	return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
		key,
		256
	);
	return toBase64(bits);
}

export function validateUsername(username: string): string | null {
	const value = username.trim();
	if (value.length < 2) return 'Pick a name with at least 2 characters.';
	if (value.length > 32) return 'Keep the name under 32 characters.';
	if (!/^[\w .-]+$/.test(value))
		return 'Use letters, numbers, spaces, dots, hyphens or underscores.';
	return null;
}

export function validatePassword(password: string): string | null {
	if (password.length < 6) return 'Use at least 6 characters.';
	return null;
}

export async function createAccount(username: string, password: string): Promise<Account> {
	const nameError = validateUsername(username);
	if (nameError) throw new Error(nameError);
	const passwordError = validatePassword(password);
	if (passwordError) throw new Error(passwordError);

	const key = username.trim().toLowerCase();
	if (await getUserByName(key)) throw new Error('That name is already used on this device.');

	const salt = crypto.getRandomValues(new Uint8Array(16));
	const user: StoredUser = {
		id: uid('user'),
		username: key,
		salt: toBase64(salt.buffer as ArrayBuffer),
		verifier: await derive(password, salt, ITERATIONS),
		iterations: ITERATIONS,
		createdAt: Date.now()
	};
	await putUser(user);
	return { id: user.id, username: user.username };
}

export async function signIn(username: string, password: string): Promise<Account> {
	const user = await getUserByName(username);
	if (!user) throw new Error('No account with that name on this device.');
	const verifier = await derive(password, fromBase64(user.salt), user.iterations);
	if (!timingSafeEqual(verifier, user.verifier)) throw new Error('That password does not match.');
	return { id: user.id, username: user.username };
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function hasAccounts(): Promise<boolean> {
	return (await countUsers()) > 0;
}

export function saveSession(account: Account, remember: boolean): void {
	const store = remember ? localStorage : sessionStorage;
	store.setItem(SESSION_KEY, JSON.stringify(account));
	(remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
}

export function clearSession(): void {
	localStorage.removeItem(SESSION_KEY);
	sessionStorage.removeItem(SESSION_KEY);
}

export async function restoreSession(): Promise<Account | null> {
	const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		const account = JSON.parse(raw) as Account;
		const user = await getUser(account.id);
		if (!user) {
			clearSession();
			return null;
		}
		return { id: user.id, username: user.username };
	} catch {
		clearSession();
		return null;
	}
}
