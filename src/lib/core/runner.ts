/**
 * Drives a prompt across many rows: a small worker pool with pause, resume,
 * stop, and per-row error capture. Kept free of Svelte so it can be unit tested
 * against a fake completion function.
 */
import { buildSchema, buildSystemPrompt, coerce } from './output';
import { extractTokens, renderTemplate } from './template';
import type { Column, GenConfig, Row, RowId } from './types';
import {
	complete as defaultComplete,
	type CompletionRequest,
	type CompletionResult
} from './ollama';

export type CompleteFn = (request: CompletionRequest) => Promise<CompletionResult>;

export type RunState = 'idle' | 'running' | 'paused' | 'stopped' | 'done';

export interface RowOutcome {
	rowId: RowId;
	ok: boolean;
	value: string;
	error: string;
	durationMs: number;
}

export interface RunnerEvents {
	onRowStart?: (rowId: RowId) => void;
	onRowDone?: (outcome: RowOutcome) => void;
	onStateChange?: (state: RunState) => void;
}

export interface RunnerOptions extends RunnerEvents {
	config: GenConfig;
	columns: Column[];
	rows: Row[];
	host?: string;
	complete?: CompleteFn;
	/** Retries per row on transport or validation failure. */
	maxAttempts?: number;
}

export class Runner {
	readonly total: number;
	private readonly options: RunnerOptions;
	private readonly complete: CompleteFn;
	private readonly queue: Row[];
	private controller = new AbortController();
	private resumeSignal: (() => void) | null = null;
	private state: RunState = 'idle';
	private cursor = 0;
	private finished: Promise<RowOutcome[]> | null = null;

	completed = 0;
	failed = 0;

	constructor(options: RunnerOptions) {
		this.options = options;
		this.complete = options.complete ?? defaultComplete;
		this.queue = options.rows.slice();
		this.total = this.queue.length;
	}

	get status(): RunState {
		return this.state;
	}

	/** Reading through a method stops the compiler narrowing state across awaits. */
	private isStopped(): boolean {
		return this.state === 'stopped';
	}

	private isPaused(): boolean {
		return this.state === 'paused';
	}

	start(): Promise<RowOutcome[]> {
		if (this.finished) return this.finished;
		this.setState('running');
		const workers = Math.max(1, Math.min(this.options.config.concurrency, this.total || 1));
		const outcomes: RowOutcome[] = [];
		this.finished = Promise.all(Array.from({ length: workers }, () => this.worker(outcomes))).then(
			() => {
				if (this.state !== 'stopped') this.setState('done');
				return outcomes;
			}
		);
		return this.finished;
	}

	pause(): void {
		if (this.state !== 'running') return;
		this.setState('paused');
	}

	resume(): void {
		if (this.state !== 'paused') return;
		this.setState('running');
		this.resumeSignal?.();
		this.resumeSignal = null;
	}

	stop(): void {
		if (this.state === 'done' || this.isStopped()) return;
		this.setState('stopped');
		this.resumeSignal?.();
		this.resumeSignal = null;
		this.controller.abort();
	}

	private setState(state: RunState): void {
		if (this.state === state) return;
		this.state = state;
		this.options.onStateChange?.(state);
	}

	private async waitWhilePaused(): Promise<void> {
		while (this.isPaused()) {
			await new Promise<void>((resolve) => {
				const previous = this.resumeSignal;
				this.resumeSignal = () => {
					previous?.();
					resolve();
				};
			});
		}
	}

	private async worker(outcomes: RowOutcome[]): Promise<void> {
		while (true) {
			await this.waitWhilePaused();
			if (this.isStopped()) return;
			// Pause may have arrived while the await above was settling.
			if (this.isPaused()) continue;
			const row = this.queue[this.cursor];
			if (!row) return;
			this.cursor += 1;
			this.options.onRowStart?.(row.id);
			const outcome = await this.runRow(row);
			if (this.isStopped() && !outcome.ok) return;
			outcomes.push(outcome);
			if (outcome.ok) this.completed += 1;
			else this.failed += 1;
			this.options.onRowDone?.(outcome);
		}
	}

	private async runRow(row: Row): Promise<RowOutcome> {
		const { config, columns } = this.options;
		const started = Date.now();
		const rendered = renderTemplate(config.template, row, columns);
		if (rendered.unknownColumns.length) {
			return {
				rowId: row.id,
				ok: false,
				value: '',
				error: `Unknown column reference: ${rendered.unknownColumns.join(', ')}`,
				durationMs: 0
			};
		}
		const tokenCount = extractTokens(config.template).length;
		if (
			rendered.text.trim() === '' ||
			(tokenCount > 0 && rendered.emptyColumns.length === tokenCount)
		) {
			return {
				rowId: row.id,
				ok: false,
				value: '',
				error: 'Every referenced cell in this row is empty.',
				durationMs: 0
			};
		}

		const system = buildSystemPrompt(config.output, config.targetColumnName, config.instructions);
		const schema = buildSchema(config.output);
		const attempts = this.options.maxAttempts ?? 2;
		let lastError = 'Unknown error.';

		for (let attempt = 0; attempt < attempts; attempt += 1) {
			if (this.isStopped()) break;
			try {
				const result = await this.complete({
					host: this.options.host,
					model: config.model,
					system:
						attempt === 0 ? system : `${system}\nYour previous reply was rejected: ${lastError}`,
					prompt: rendered.text,
					schema,
					temperature: config.temperature,
					numPredict: config.numPredict,
					think: config.think,
					signal: this.controller.signal
				});
				const parsed = coerce(config.output, result.content);
				if (parsed.ok) {
					return {
						rowId: row.id,
						ok: true,
						value: parsed.value,
						error: '',
						durationMs: Date.now() - started
					};
				}
				lastError = parsed.reason;
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				if (this.isStopped()) break;
				const fatal = error instanceof Error && 'kind' in error && error.kind === 'offline';
				if (fatal) break;
			}
		}
		return {
			rowId: row.id,
			ok: false,
			value: '',
			error: this.isStopped() ? 'Stopped before finishing.' : lastError,
			durationMs: Date.now() - started
		};
	}
}
