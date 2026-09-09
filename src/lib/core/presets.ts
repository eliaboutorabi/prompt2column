/** Starting points for the composer. Each one sets an output shape and a prompt skeleton. */
import type { Column, OutputSpec, Row } from './types';
import { defaultOutputSpec } from './types';

export interface Preset {
	id: string;
	label: string;
	blurb: string;
	columnName: string;
	output: OutputSpec;
	/** Builds a first draft prompt from whatever columns the sheet has. */
	template: (columns: Column[], rows?: Row[]) => string;
	instructions: string;
}

const MAX_REFS = 8;

/**
 * Lists the sheet's own columns as prompt references. Narrow sheets get every
 * column; wide ones get the ones carrying the most text, since those are what a
 * model actually needs to judge a row.
 */
function refs(columns: Column[], rows: Row[] = []): string {
	const usable = columns.filter((column) => !column.generated);
	if (!usable.length) return '{{Column}}';
	let chosen = usable;
	if (usable.length > MAX_REFS) {
		const sample = rows.slice(0, 30);
		const weight = (column: Column) =>
			sample.length
				? sample.reduce((sum, row) => sum + (row.cells[column.id] ?? '').trim().length, 0) /
					sample.length
				: 0;
		const ranked = [...usable].sort((a, b) => weight(b) - weight(a)).slice(0, MAX_REFS);
		chosen = usable.filter((column) => ranked.includes(column));
	}
	return chosen.map((column) => `${column.name}: {{${column.name}}}`).join('\n');
}

export const PRESETS: Preset[] = [
	{
		id: 'classify',
		label: 'Classify',
		blurb: 'Sort each row into one label from a fixed list.',
		columnName: 'Category',
		output: {
			...defaultOutputSpec(),
			kind: 'choice',
			choices: ['positive', 'neutral', 'negative'],
			allowOther: false
		},
		instructions: 'Judge only what the text says. Do not guess beyond it.',
		template: (columns, rows) => `Classify this row.\n\n${refs(columns, rows)}`
	},
	{
		id: 'decide',
		label: 'Approve or reject',
		blurb: 'A yes or no call, written with your own two labels.',
		columnName: 'Decision',
		output: {
			...defaultOutputSpec(),
			kind: 'boolean',
			trueLabel: 'Approve',
			falseLabel: 'Reject'
		},
		instructions: 'Apply the policy strictly. When the row is missing evidence, reject it.',
		template: (columns, rows) =>
			`Decide whether to approve this request.\n\n${refs(columns, rows)}\n\nPolicy: approve when the request is clearly justified and within limits. Otherwise reject.`
	},
	{
		id: 'summarize',
		label: 'Summarize',
		blurb: 'A short piece of free text per row.',
		columnName: 'Summary',
		output: { ...defaultOutputSpec(), kind: 'text', maxWords: 25 },
		instructions: 'Keep the original meaning. Do not add facts that are not in the row.',
		template: (columns, rows) => `Summarize this row in one sentence.\n\n${refs(columns, rows)}`
	},
	{
		id: 'score',
		label: 'Score',
		blurb: 'A number in a range you set.',
		columnName: 'Score',
		output: { ...defaultOutputSpec(), kind: 'number', min: 1, max: 5, integer: true },
		instructions: '1 is the weakest, 5 is the strongest.',
		template: (columns, rows) => `Rate this row from 1 to 5.\n\n${refs(columns, rows)}`
	},
	{
		id: 'blank',
		label: 'Start blank',
		blurb: 'Write the prompt yourself.',
		columnName: 'Result',
		output: defaultOutputSpec(),
		instructions: '',
		template: () => ''
	}
];

export function presetById(id: string): Preset {
	return PRESETS.find((preset) => preset.id === id) ?? PRESETS[PRESETS.length - 1];
}
