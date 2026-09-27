import { describe, expect, it } from 'vitest';
import { detectKind, isCategorical, labelTone } from './columns';
import type { Column, Row } from './types';

const column: Column = { id: 'c', name: 'Value', generated: false };
const rows = (values: string[]): Row[] =>
	values.map((value, i) => ({ id: `r${i}`, cells: { c: value } }));

describe('detectKind', () => {
	it('calls a generated column generated, whatever it holds', () => {
		expect(detectKind({ ...column, generated: true }, rows(['12']))).toBe('generated');
	});

	it('spots numbers, including separators, decimals and percentages', () => {
		expect(detectKind(column, rows(['240', '1,850', '-3.5', '12%']))).toBe('number');
	});

	it('spots ISO dates', () => {
		expect(detectKind(column, rows(['2026-02-03', '2026-02-11 09:30']))).toBe('date');
	});

	it('falls back to text when any value is not a number', () => {
		expect(detectKind(column, rows(['240', 'n/a']))).toBe('text');
	});

	it('ignores blank cells when deciding', () => {
		expect(detectKind(column, rows(['', '12', '  ', '7']))).toBe('number');
	});

	it('treats an empty column as text', () => {
		expect(detectKind(column, rows(['', '']))).toBe('text');
	});
});

describe('isCategorical', () => {
	it('recognises a few repeating short labels', () => {
		expect(isCategorical(column, rows(['Approve', 'Reject', 'Approve', '']))).toBe(true);
	});

	it('rejects free text', () => {
		expect(
			isCategorical(column, rows(['Participant struggled with onboarding and skipped the tour.']))
		).toBe(false);
	});

	it('rejects a column with too many different values', () => {
		expect(isCategorical(column, rows('abcdefghij'.split('').flatMap((v) => [v, v])))).toBe(false);
	});

	it('rejects a list where every value is different', () => {
		expect(isCategorical(column, rows(['Ines', 'Tomasz', 'Amara', 'Bilal', 'Sanne']))).toBe(false);
	});

	it('accepts two or three one-off labels, as a run in progress produces', () => {
		expect(isCategorical(column, rows(['positive', 'negative', '']))).toBe(true);
	});

	it('rejects an empty column', () => {
		expect(isCategorical(column, rows(['', '']))).toBe(false);
	});
});

describe('labelTone', () => {
	it('colours obvious words by meaning', () => {
		expect(labelTone('Approve')).toBe(2);
		expect(labelTone('positive')).toBe(2);
		expect(labelTone('Reject')).toBe(6);
		expect(labelTone('negative')).toBe(6);
		expect(labelTone('neutral')).toBe(3);
	});

	it('gives other labels a stable colour', () => {
		expect(labelTone('billing')).toBe(labelTone('Billing'));
		expect([1, 3, 4, 5]).toContain(labelTone('billing'));
	});
});
