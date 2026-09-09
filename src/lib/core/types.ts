/** Domain types shared by the whole app. */

export type ColumnId = string;
export type RowId = string;

export interface Column {
	id: ColumnId;
	name: string;
	/** True when the column was produced by a prompt run. */
	generated: boolean;
}

export interface Row {
	id: RowId;
	cells: Record<ColumnId, string>;
}

export interface Table {
	columns: Column[];
	rows: Row[];
}

export type OutputKind = 'text' | 'choice' | 'number' | 'boolean';

export interface OutputSpec {
	kind: OutputKind;
	/** `choice`: the allowed labels, in display order. */
	choices: string[];
	/** `choice`: accept a value outside the list instead of failing the cell. */
	allowOther: boolean;
	/** `number`: inclusive bounds, null when unbounded. */
	min: number | null;
	max: number | null;
	integer: boolean;
	/** `boolean`: the two labels written into the cell. */
	trueLabel: string;
	falseLabel: string;
	/** `text`: soft length budget handed to the model. */
	maxWords: number | null;
}

export type ScopeKind = 'all' | 'selected' | 'range' | 'first' | 'empty';

export interface RowScope {
	kind: ScopeKind;
	/** 1-based, inclusive, used by `range`. */
	from: number;
	to: number;
	/** used by `first`. */
	count: number;
}

export interface GenConfig {
	model: string;
	targetColumnName: string;
	template: string;
	/** Extra rules appended to the system prompt. */
	instructions: string;
	output: OutputSpec;
	scope: RowScope;
	concurrency: number;
	temperature: number;
	/** Hard cap on generated tokens, null lets the model decide. */
	numPredict: number | null;
	/** Ask thinking-capable models to skip their reasoning pass. */
	think: boolean;
	/** Rewrite target cells that already hold a value. */
	overwrite: boolean;
}

export interface Project {
	id: string;
	ownerId: string;
	name: string;
	fileName: string | null;
	createdAt: number;
	updatedAt: number;
	columns: Column[];
	rows: Row[];
	config: GenConfig;
}

export interface ProjectSummary {
	id: string;
	ownerId: string;
	name: string;
	fileName: string | null;
	createdAt: number;
	updatedAt: number;
	rowCount: number;
	columnCount: number;
}

export type CellStatus = 'idle' | 'queued' | 'running' | 'done' | 'error';

export interface RunError {
	rowId: RowId;
	message: string;
}

export function defaultOutputSpec(): OutputSpec {
	return {
		kind: 'text',
		choices: [],
		allowOther: false,
		min: null,
		max: null,
		integer: false,
		trueLabel: 'Approve',
		falseLabel: 'Reject',
		maxWords: 25
	};
}

export function defaultScope(): RowScope {
	return { kind: 'all', from: 1, to: 25, count: 10 };
}

export function defaultConfig(): GenConfig {
	return {
		model: '',
		targetColumnName: '',
		template: '',
		instructions: '',
		output: defaultOutputSpec(),
		scope: defaultScope(),
		concurrency: 2,
		temperature: 0,
		numPredict: 256,
		think: false,
		overwrite: true
	};
}

let counter = 0;
export function uid(prefix = 'id'): string {
	counter += 1;
	const rand =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `${prefix}_${rand}${counter.toString(36)}`;
}
