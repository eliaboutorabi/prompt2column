/** Runs in a real browser: IndexedDB and WebCrypto have no useful stand-in. */
import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearSession,
	createAccount,
	restoreSession,
	saveSession,
	signIn,
	validatePassword,
	validateUsername
} from './auth';
import { deleteProject, getProject, listProjects, putProject } from './db';
import { defaultConfig, uid, type Project } from './types';

function unique(prefix: string): string {
	return `${prefix}.${Math.random().toString(36).slice(2, 8)}`;
}

function makeProject(ownerId: string, name: string): Project {
	return {
		id: uid('proj'),
		ownerId,
		name,
		fileName: 'tickets.csv',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		columns: [{ id: 'c1', name: 'Message', generated: false }],
		rows: [{ id: 'r1', cells: { c1: 'Charged twice in March' } }],
		config: defaultConfig()
	};
}

beforeEach(() => {
	clearSession();
});

describe('account rules', () => {
	it('rejects a name that is too short', () => {
		expect(validateUsername('a')).toMatch(/at least 2/);
	});

	it('rejects a name with punctuation it cannot store', () => {
		expect(validateUsername('ines/moreau')).toMatch(/letters, numbers/);
	});

	it('accepts an ordinary name', () => {
		expect(validateUsername('ines.moreau')).toBeNull();
	});

	it('rejects a short passphrase', () => {
		expect(validatePassword('12345')).toMatch(/at least 6/);
	});
});

describe('accounts', () => {
	it('creates an account and signs back in', async () => {
		const name = unique('ines');
		const created = await createAccount(name, 'winter-harbour');
		const signedIn = await signIn(name, 'winter-harbour');
		expect(signedIn.id).toBe(created.id);
	});

	it('is case insensitive about the name', async () => {
		const name = unique('Tomasz');
		await createAccount(name, 'winter-harbour');
		await expect(signIn(name.toUpperCase(), 'winter-harbour')).resolves.toBeTruthy();
	});

	it('refuses the wrong passphrase', async () => {
		const name = unique('amara');
		await createAccount(name, 'winter-harbour');
		await expect(signIn(name, 'summer-harbour')).rejects.toThrow(/does not match/);
	});

	it('refuses an unknown name', async () => {
		await expect(signIn(unique('nobody'), 'winter-harbour')).rejects.toThrow(/No account/);
	});

	it('refuses a duplicate name', async () => {
		const name = unique('bilal');
		await createAccount(name, 'winter-harbour');
		await expect(createAccount(name, 'other-pass')).rejects.toThrow(/already used/);
	});

	it('never stores the passphrase itself', async () => {
		const name = unique('sanne');
		await createAccount(name, 'winter-harbour');
		const dump = JSON.stringify(localStorage) + JSON.stringify(sessionStorage);
		expect(dump).not.toContain('winter-harbour');
	});
});

describe('sessions', () => {
	it('restores a remembered session', async () => {
		const account = await createAccount(unique('freya'), 'winter-harbour');
		saveSession(account, true);
		await expect(restoreSession()).resolves.toMatchObject({ id: account.id });
	});

	it('keeps a non-remembered session out of localStorage', async () => {
		const account = await createAccount(unique('diego'), 'winter-harbour');
		saveSession(account, false);
		expect(localStorage.getItem('prompt2column:session')).toBeNull();
		await expect(restoreSession()).resolves.toMatchObject({ id: account.id });
	});

	it('drops a session whose account is gone', async () => {
		saveSession({ id: 'user_missing', username: 'ghost' }, true);
		await expect(restoreSession()).resolves.toBeNull();
	});

	it('returns nothing after signing out', async () => {
		const account = await createAccount(unique('marta'), 'winter-harbour');
		saveSession(account, true);
		clearSession();
		await expect(restoreSession()).resolves.toBeNull();
	});
});

describe('project storage', () => {
	it('saves a project and reads it back whole', async () => {
		const project = makeProject(unique('owner'), 'Support tickets');
		await putProject(project);
		const stored = await getProject(project.id);
		expect(stored?.rows[0].cells.c1).toBe('Charged twice in March');
	});

	it('lists only the projects of one account, newest first', async () => {
		const mine = unique('owner');
		const theirs = unique('owner');
		const older = makeProject(mine, 'Older');
		older.updatedAt = Date.now() - 60_000;
		await putProject(older);
		await putProject(makeProject(mine, 'Newer'));
		await putProject(makeProject(theirs, 'Not mine'));
		const summaries = await listProjects(mine);
		expect(summaries.map((summary) => summary.name)).toEqual(['Newer', 'Older']);
		expect(summaries[0].rowCount).toBe(1);
	});

	it('overwrites on save rather than duplicating', async () => {
		const owner = unique('owner');
		const project = makeProject(owner, 'Draft');
		await putProject(project);
		project.name = 'Renamed';
		await putProject(project);
		const summaries = await listProjects(owner);
		expect(summaries).toHaveLength(1);
		expect(summaries[0].name).toBe('Renamed');
	});

	it('deletes a project', async () => {
		const owner = unique('owner');
		const project = makeProject(owner, 'Temporary');
		await putProject(project);
		await deleteProject(project.id);
		await expect(getProject(project.id)).resolves.toBeUndefined();
		await expect(listProjects(owner)).resolves.toHaveLength(0);
	});
});
