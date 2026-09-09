import { describe, expect, it } from 'vitest';
import { PRESETS, presetById } from './presets';
import { extractTokens } from './template';
import type { Column, Row } from './types';

const columns: Column[] = [
	{ id: 'c1', name: 'Customer', generated: false },
	{ id: 'c2', name: 'Message', generated: false },
	{ id: 'c3', name: 'Sentiment', generated: true }
];

const wide: Column[] = Array.from({ length: 11 }, (_, index) => ({
	id: `w${index}`,
	name: `Field ${index}`,
	generated: false
}));

const wideRows: Row[] = [
	{
		id: 'r1',
		cells: Object.fromEntries(wide.map((column, index) => [column.id, 'x'.repeat(index * 10)]))
	}
];

describe('presets', () => {
	it('covers the three jobs the app is built around', () => {
		expect(PRESETS.map((preset) => preset.id)).toContain('classify');
		expect(PRESETS.map((preset) => preset.id)).toContain('decide');
		expect(PRESETS.map((preset) => preset.id)).toContain('summarize');
	});

	it('builds prompts that reference real columns', () => {
		for (const preset of PRESETS.filter((candidate) => candidate.id !== 'blank')) {
			const names = extractTokens(preset.template(columns)).map((token) => token.name);
			expect(names.length).toBeGreaterThan(0);
			for (const name of names) {
				expect(columns.map((column) => column.name)).toContain(name);
			}
		}
	});

	it('never references a generated column in a starter prompt', () => {
		const names = extractTokens(presetById('classify').template(columns)).map(
			(token) => token.name
		);
		expect(names).not.toContain('Sentiment');
	});

	it('gives the classify preset a closed label list', () => {
		const preset = presetById('classify');
		expect(preset.output.kind).toBe('choice');
		expect(preset.output.allowOther).toBe(false);
		expect(preset.output.choices.length).toBeGreaterThan(1);
	});

	it('gives the decision preset two labels and no free text', () => {
		const preset = presetById('decide');
		expect(preset.output.kind).toBe('boolean');
		expect(preset.output.trueLabel).not.toBe(preset.output.falseLabel);
	});

	it('references every column of a narrow sheet', () => {
		const names = extractTokens(presetById('decide').template(columns)).map((token) => token.name);
		expect(names).toEqual(['Customer', 'Message']);
	});

	it('keeps the text-heavy columns when a sheet is too wide to list', () => {
		const names = extractTokens(presetById('summarize').template(wide, wideRows)).map(
			(token) => token.name
		);
		expect(names).toHaveLength(8);
		expect(names).toContain('Field 10');
		expect(names).not.toContain('Field 0');
	});

	it('falls back to the blank preset for an unknown id', () => {
		expect(presetById('nope').id).toBe('blank');
	});
});
