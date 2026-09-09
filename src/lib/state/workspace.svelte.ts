/** The open project: table data, composer config, run progress, autosave. */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { getProject, putProject } from '$lib/core/db';
import { findColumn, renameInTemplate, validateTemplate } from '$lib/core/template';
import { resolveScope } from '$lib/core/scope';
import { Runner, type RowOutcome, type RunState } from '$lib/core/runner';
import { toCsv } from '$lib/core/csv';
import { uid, type CellStatus, type Column, type Project, type Row } from '$lib/core/types';

const AUTOSAVE_MS = 400;

export class Workspace {
	project = $state<Project | null>(null);
	loading = $state(true);
	loadError = $state('');
	saving = $state(false);

	selected = new SvelteSet<string>();
	cellStatus = new SvelteMap<string, CellStatus>();
	cellError = new SvelteMap<string, string>();

	runState = $state<RunState>('idle');
	runTotal = $state(0);
	runDone = $state(0);
	runFailed = $state(0);
	runStartedAt = $state(0);
	runElapsedMs = $state(0);
	runMessage = $state('');
	lastRunColumnId = $state<string | null>(null);

	private runner: Runner | null = null;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private tickTimer: ReturnType<typeof setInterval> | null = null;

	get columns(): Column[] {
		return this.project?.columns ?? [];
	}

	get rows(): Row[] {
		return this.project?.rows ?? [];
	}

	get sourceColumns(): Column[] {
		return this.columns.filter((column) => column.name !== this.project?.config.targetColumnName);
	}

	get templateIssues() {
		return validateTemplate(this.project?.config.template ?? '', this.columns);
	}

	get targetColumn(): Column | null {
		const name = this.project?.config.targetColumnName ?? '';
		return name ? (findColumn(this.columns, name) ?? null) : null;
	}

	get scopedRows(): Row[] {
		if (!this.project) return [];
		return resolveScope({
			scope: this.project.config.scope,
			rows: this.project.rows,
			// A plain copy: resolveScope only reads it, so reactivity is not wanted here.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			selected: new Set(this.selected),
			targetColumnId: this.targetColumn?.id ?? null,
			overwrite: this.project.config.overwrite
		});
	}

	get canRun(): boolean {
		const config = this.project?.config;
		if (!config) return false;
		const issues = this.templateIssues;
		return (
			config.model !== '' &&
			config.targetColumnName.trim() !== '' &&
			config.template.trim() !== '' &&
			issues.unknown.length === 0 &&
			this.scopedRows.length > 0 &&
			this.runState !== 'running' &&
			this.runState !== 'paused'
		);
	}

	get isBusy(): boolean {
		return this.runState === 'running' || this.runState === 'paused';
	}

	async load(id: string): Promise<void> {
		this.loading = true;
		this.loadError = '';
		try {
			const project = await getProject(id);
			if (!project) {
				this.loadError = 'That project is not on this device.';
				this.project = null;
				return;
			}
			this.project = project;
			this.selected.clear();
			this.cellStatus.clear();
			this.cellError.clear();
		} catch (error) {
			this.loadError = error instanceof Error ? error.message : String(error);
		} finally {
			this.loading = false;
		}
	}

	touch(): void {
		if (!this.project) return;
		this.project.updatedAt = Date.now();
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => void this.flush(), AUTOSAVE_MS);
	}

	async flush(): Promise<void> {
		if (!this.project) return;
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		this.saving = true;
		try {
			await putProject($state.snapshot(this.project) as Project);
		} finally {
			this.saving = false;
		}
	}

	rename(name: string): void {
		if (!this.project) return;
		this.project.name = name.trim() || 'Untitled sheet';
		this.touch();
	}

	renameColumn(columnId: string, nextName: string): string | null {
		if (!this.project) return null;
		const trimmed = nextName.trim();
		if (!trimmed) return 'A column needs a name.';
		const clash = this.project.columns.find(
			(column) => column.id !== columnId && column.name.toLowerCase() === trimmed.toLowerCase()
		);
		if (clash) return `There is already a column called "${clash.name}".`;
		const column = this.project.columns.find((c) => c.id === columnId);
		if (!column) return 'That column is gone.';
		const previous = column.name;
		column.name = trimmed;
		this.project.config.template = renameInTemplate(
			this.project.config.template,
			previous,
			trimmed
		);
		if (this.project.config.targetColumnName === previous) {
			this.project.config.targetColumnName = trimmed;
		}
		this.touch();
		return null;
	}

	deleteColumn(columnId: string): void {
		if (!this.project) return;
		this.project.columns = this.project.columns.filter((column) => column.id !== columnId);
		for (const row of this.project.rows) delete row.cells[columnId];
		if (this.lastRunColumnId === columnId) this.lastRunColumnId = null;
		this.touch();
	}

	setCell(rowId: string, columnId: string, value: string): void {
		const row = this.project?.rows.find((candidate) => candidate.id === rowId);
		if (!row) return;
		row.cells[columnId] = value;
		this.touch();
	}

	toggleRow(rowId: string): void {
		if (this.selected.has(rowId)) this.selected.delete(rowId);
		else this.selected.add(rowId);
	}

	selectAll(on: boolean): void {
		this.selected.clear();
		if (on) for (const row of this.rows) this.selected.add(row.id);
	}

	/** Creates the run target column when it does not exist yet. */
	private ensureTargetColumn(): Column {
		if (!this.project) throw new Error('No project is open.');
		const name = this.project.config.targetColumnName.trim();
		const existing = findColumn(this.project.columns, name);
		if (existing) return existing;
		const column: Column = { id: uid('col'), name, generated: true };
		this.project.columns = [...this.project.columns, column];
		for (const row of this.project.rows) row.cells[column.id] = '';
		this.touch();
		return column;
	}

	async run(host: string): Promise<void> {
		if (!this.project || !this.canRun) return;
		const config = $state.snapshot(this.project.config) as Project['config'];
		const column = this.ensureTargetColumn();
		const rows = this.scopedRows;

		this.lastRunColumnId = column.id;
		this.runTotal = rows.length;
		this.runDone = 0;
		this.runFailed = 0;
		this.runMessage = '';
		this.runStartedAt = Date.now();
		this.runElapsedMs = 0;
		this.cellStatus.clear();
		this.cellError.clear();
		for (const row of rows) this.cellStatus.set(row.id, 'queued');
		this.startTicker();

		const runner = new Runner({
			config,
			columns: $state.snapshot(this.project.columns) as Column[],
			rows: $state.snapshot(rows) as Row[],
			host,
			onRowStart: (rowId) => this.cellStatus.set(rowId, 'running'),
			onRowDone: (outcome) => this.applyOutcome(column.id, outcome),
			onStateChange: (state) => {
				this.runState = state;
			}
		});
		this.runner = runner;

		try {
			await runner.start();
			if (this.runFailed > 0) {
				this.runMessage = `${this.runFailed} of ${this.runTotal} rows did not produce a value.`;
			}
		} catch (error) {
			this.runMessage = error instanceof Error ? error.message : String(error);
		} finally {
			this.stopTicker();
			this.runner = null;
			for (const [rowId, status] of this.cellStatus) {
				if (status === 'queued' || status === 'running') this.cellStatus.delete(rowId);
			}
			await this.flush();
		}
	}

	private applyOutcome(columnId: string, outcome: RowOutcome): void {
		if (outcome.ok) {
			this.setCell(outcome.rowId, columnId, outcome.value);
			this.cellStatus.set(outcome.rowId, 'done');
			this.cellError.delete(outcome.rowId);
			this.runDone += 1;
		} else {
			this.cellStatus.set(outcome.rowId, 'error');
			this.cellError.set(outcome.rowId, outcome.error);
			this.runFailed += 1;
		}
	}

	pause(): void {
		this.runner?.pause();
	}

	resume(): void {
		this.runner?.resume();
	}

	stop(): void {
		this.runner?.stop();
		this.runMessage = 'Run stopped.';
	}

	get failedRows(): Row[] {
		return this.rows.filter((row) => this.cellStatus.get(row.id) === 'error');
	}

	/** Re-runs only the rows that errored, without touching the rest. */
	async retryFailed(host: string): Promise<void> {
		if (!this.project || this.isBusy) return;
		const failed = this.failedRows;
		if (!failed.length) return;
		this.selected.clear();
		for (const row of failed) this.selected.add(row.id);
		this.project.config.scope = { ...this.project.config.scope, kind: 'selected' };
		this.project.config.overwrite = true;
		await this.run(host);
	}

	private startTicker(): void {
		this.stopTicker();
		this.tickTimer = setInterval(() => {
			this.runElapsedMs = Date.now() - this.runStartedAt;
		}, 250);
	}

	private stopTicker(): void {
		if (this.tickTimer) clearInterval(this.tickTimer);
		this.tickTimer = null;
		if (this.runStartedAt) this.runElapsedMs = Date.now() - this.runStartedAt;
	}

	exportCsv(): string {
		return toCsv(this.columns, this.rows);
	}

	dispose(): void {
		this.runner?.stop();
		this.stopTicker();
		if (this.saveTimer) clearTimeout(this.saveTimer);
	}
}
