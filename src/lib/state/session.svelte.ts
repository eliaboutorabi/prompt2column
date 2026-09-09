/** Signed-in account plus the project list for that account. */
import {
	clearSession,
	createAccount,
	restoreSession,
	saveSession,
	signIn,
	type Account
} from '$lib/core/auth';
import { deleteProject, listProjects, putProject } from '$lib/core/db';
import { defaultConfig, uid, type Project, type ProjectSummary, type Table } from '$lib/core/types';

class SessionStore {
	account = $state<Account | null>(null);
	projects = $state<ProjectSummary[]>([]);
	ready = $state(false);
	busy = $state(false);
	error = $state('');

	async init(): Promise<void> {
		try {
			this.account = await restoreSession();
			if (this.account) await this.refreshProjects();
		} catch (error) {
			this.error = message(error);
		} finally {
			this.ready = true;
		}
	}

	async register(username: string, password: string, remember: boolean): Promise<boolean> {
		return this.attempt(async () => {
			const account = await createAccount(username, password);
			saveSession(account, remember);
			this.account = account;
			await this.refreshProjects();
		});
	}

	async login(username: string, password: string, remember: boolean): Promise<boolean> {
		return this.attempt(async () => {
			const account = await signIn(username, password);
			saveSession(account, remember);
			this.account = account;
			await this.refreshProjects();
		});
	}

	signOut(): void {
		clearSession();
		this.account = null;
		this.projects = [];
		this.error = '';
	}

	async refreshProjects(): Promise<void> {
		if (!this.account) {
			this.projects = [];
			return;
		}
		this.projects = await listProjects(this.account.id);
	}

	async createProject(name: string, table: Table, fileName: string | null): Promise<Project> {
		if (!this.account) throw new Error('Sign in first.');
		const now = Date.now();
		const project: Project = {
			id: uid('proj'),
			ownerId: this.account.id,
			name: name.trim() || 'Untitled sheet',
			fileName,
			createdAt: now,
			updatedAt: now,
			columns: table.columns,
			rows: table.rows,
			config: defaultConfig()
		};
		await putProject(project);
		await this.refreshProjects();
		return project;
	}

	async removeProject(id: string): Promise<void> {
		await deleteProject(id);
		await this.refreshProjects();
	}

	private async attempt(body: () => Promise<void>): Promise<boolean> {
		this.busy = true;
		this.error = '';
		try {
			await body();
			return true;
		} catch (error) {
			this.error = message(error);
			return false;
		} finally {
			this.busy = false;
		}
	}
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export const session = new SessionStore();
