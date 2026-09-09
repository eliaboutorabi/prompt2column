import { describe, expect, it } from 'vitest';
import { describeScope, resolveScope } from './scope';
import { defaultScope, type Row } from './types';

const rows: Row[] = Array.from({ length: 6 }, (_, index) => ({
	id: `r${index + 1}`,
	cells: { c1: `value ${index + 1}`, out: index % 2 === 0 ? '' : 'filled' }
}));

const base = {
	rows,
	selected: new Set<string>(),
	targetColumnId: 'out',
	overwrite: true
};

describe('resolveScope', () => {
	it('takes every row by default', () => {
		expect(resolveScope({ ...base, scope: defaultScope() })).toHaveLength(6);
	});

	it('takes the first N rows', () => {
		const result = resolveScope({ ...base, scope: { ...defaultScope(), kind: 'first', count: 2 } });
		expect(result.map((row) => row.id)).toEqual(['r1', 'r2']);
	});

	it('takes an inclusive range', () => {
		const result = resolveScope({
			...base,
			scope: { ...defaultScope(), kind: 'range', from: 2, to: 4 }
		});
		expect(result.map((row) => row.id)).toEqual(['r2', 'r3', 'r4']);
	});

	it('accepts a reversed range', () => {
		const result = resolveScope({
			...base,
			scope: { ...defaultScope(), kind: 'range', from: 4, to: 2 }
		});
		expect(result.map((row) => row.id)).toEqual(['r2', 'r3', 'r4']);
	});

	it('clamps a range past the end of the sheet', () => {
		const result = resolveScope({
			...base,
			scope: { ...defaultScope(), kind: 'range', from: 5, to: 99 }
		});
		expect(result.map((row) => row.id)).toEqual(['r5', 'r6']);
	});

	it('takes the ticked rows', () => {
		const result = resolveScope({
			...base,
			selected: new Set(['r2', 'r5']),
			scope: { ...defaultScope(), kind: 'selected' }
		});
		expect(result.map((row) => row.id)).toEqual(['r2', 'r5']);
	});

	it('takes only rows with an empty target cell', () => {
		const result = resolveScope({ ...base, scope: { ...defaultScope(), kind: 'empty' } });
		expect(result.map((row) => row.id)).toEqual(['r1', 'r3', 'r5']);
	});

	it('skips filled cells when overwrite is off', () => {
		const result = resolveScope({ ...base, overwrite: false, scope: defaultScope() });
		expect(result.map((row) => row.id)).toEqual(['r1', 'r3', 'r5']);
	});

	it('keeps every row when the target column does not exist yet', () => {
		const result = resolveScope({
			...base,
			targetColumnId: null,
			overwrite: false,
			scope: defaultScope()
		});
		expect(result).toHaveLength(6);
	});
});

describe('describeScope', () => {
	it('describes each mode in plain words', () => {
		expect(describeScope(defaultScope(), 6, 0)).toBe('all 6 rows');
		expect(describeScope({ ...defaultScope(), kind: 'first', count: 3 }, 6, 0)).toBe(
			'first 3 rows'
		);
		expect(describeScope({ ...defaultScope(), kind: 'selected' }, 6, 1)).toBe('1 selected row');
	});
});
