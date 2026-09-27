import { describe, expect, it } from 'vitest';
import { countValues, formatShare } from './counts';
import type { Row } from './types';

function rows(values: string[]): Row[] {
	return values.map((value, index) => ({ id: `r${index}`, cells: { d: value } }));
}

describe('countValues', () => {
	it('tallies each value, most frequent first', () => {
		const counts = countValues(rows(['Approve', 'Reject', 'Approve', 'Approve', 'Reject']), 'd');
		expect(counts.values.map(({ value, count }) => [value, count])).toEqual([
			['Approve', 3],
			['Reject', 2]
		]);
		expect(counts.total).toBe(5);
	});

	it('remembers which rows hold each value', () => {
		const counts = countValues(rows(['Approve', 'Reject', 'Approve']), 'd');
		expect(counts.values[0].rowIds).toEqual(['r0', 'r2']);
		expect(counts.values[1].rowIds).toEqual(['r1']);
	});

	it('orders ties alphabetically so the list does not jump around', () => {
		const counts = countValues(rows(['neutral', 'negative', 'positive']), 'd');
		expect(counts.values.map((entry) => entry.value)).toEqual(['negative', 'neutral', 'positive']);
	});

	it('counts blank cells on their own, not as a value', () => {
		const counts = countValues(rows(['Approve', '', '   ', 'Approve']), 'd');
		expect(counts.values).toHaveLength(1);
		expect(counts.empty).toEqual({ value: '', count: 2, rowIds: ['r1', 'r2'] });
	});

	it('treats a missing cell as blank', () => {
		const counts = countValues([{ id: 'r0', cells: {} }], 'd');
		expect(counts.empty?.count).toBe(1);
	});

	it('has no blank entry when every cell is filled', () => {
		expect(countValues(rows(['Approve']), 'd').empty).toBeNull();
	});

	it('trims but otherwise keeps values exactly as written', () => {
		const counts = countValues(rows([' Email', 'Email ', 'email']), 'd');
		expect(counts.values.map(({ value, count }) => [value, count])).toEqual([
			['Email', 2],
			['email', 1]
		]);
	});

	it('rolls values past the limit into one line', () => {
		const values = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e'];
		const counts = countValues(rows(values), 'd', 2);
		expect(counts.values.map((entry) => entry.value)).toEqual(['a', 'b']);
		expect(counts.others).toEqual({ distinct: 3, count: 3 });
	});

	it('reports no others when everything fits', () => {
		expect(countValues(rows(['a', 'b']), 'd').others).toEqual({ distinct: 0, count: 0 });
	});

	it('handles an empty sheet', () => {
		expect(countValues([], 'd')).toEqual({
			total: 0,
			values: [],
			empty: null,
			others: { distinct: 0, count: 0 }
		});
	});
});

describe('formatShare', () => {
	it('rounds to a whole percentage', () => {
		expect(formatShare(9, 15)).toBe('60%');
		expect(formatShare(1, 3)).toBe('33%');
	});

	it('never shows a real count as 0%', () => {
		expect(formatShare(1, 400)).toBe('<1%');
	});

	it('shows 0% for nothing, and does not divide by zero', () => {
		expect(formatShare(0, 15)).toBe('0%');
		expect(formatShare(0, 0)).toBe('0%');
	});
});
