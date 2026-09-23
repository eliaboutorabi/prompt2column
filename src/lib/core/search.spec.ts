import { describe, expect, it } from 'vitest';
import {
	cellKey,
	excerpt,
	findRanges,
	fold,
	normalizeQuery,
	searchTable,
	splitByRanges,
	stepIndex
} from './search';
import type { Column, Row } from './types';

const columns: Column[] = [
	{ id: 'name', name: 'Customer', generated: false },
	{ id: 'msg', name: 'Message', generated: false },
	{ id: 'out', name: 'Decision', generated: true }
];

const rows: Row[] = [
	{ id: 'r1', cells: { name: 'Marta Kovács', msg: 'Billing charged twice', out: 'Reject' } },
	{ id: 'r2', cells: { name: 'Elif Yalçın', msg: 'Asked about a discount', out: 'Approve' } },
	{ id: 'r3', cells: { name: 'Kwame Boateng', msg: 'Billing fixed on the spot', out: 'Approve' } },
	{ id: 'r4', cells: { name: 'Petra Novakova', msg: '', out: '' } }
];

describe('fold', () => {
	it('lowercases plain text without building a position map', () => {
		expect(fold('Billing')).toEqual({ text: 'billing', source: null });
	});

	it('strips accents and remembers where each letter came from', () => {
		const folded = fold('Kovács');
		expect(folded.text).toBe('kovacs');
		expect(folded.source).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('keeps positions straight after a character outside the basic plane', () => {
		const folded = fold('🙂é');
		expect(folded.text).toBe('🙂e');
		expect(folded.source).toEqual([0, 0, 2]);
	});
});

describe('findRanges', () => {
	it('finds every occurrence, ignoring case', () => {
		expect(findRanges('Billing, then more billing', 'billing')).toEqual([
			{ start: 0, end: 7 },
			{ start: 19, end: 26 }
		]);
	});

	it('matches accented text from an unaccented query', () => {
		const value = 'Marta Kovács';
		const [range] = findRanges(value, normalizeQuery('kovacs'));
		expect(value.slice(range.start, range.end)).toBe('Kovács');
	});

	it('matches unaccented text from an accented query', () => {
		expect(findRanges('Marta Kovacs', normalizeQuery('Kovács'))).toHaveLength(1);
	});

	it('returns ranges that slice the original text even after an emoji', () => {
		const value = '🙂 Café au lait';
		const [range] = findRanges(value, normalizeQuery('cafe'));
		expect(value.slice(range.start, range.end)).toBe('Café');
	});

	it('does not overlap repeated matches', () => {
		expect(findRanges('aaaa', 'aa')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 4 }
		]);
	});

	it('finds nothing in an empty cell', () => {
		expect(findRanges('', 'a')).toEqual([]);
	});
});

describe('searchTable', () => {
	it('returns matching cells in reading order', () => {
		const result = searchTable(columns, rows, 'billing');
		expect(result.matches.map((match) => [match.rowId, match.columnId])).toEqual([
			['r1', 'msg'],
			['r3', 'msg']
		]);
		expect(result.rowCount).toBe(2);
	});

	it('records where each match sits in the sheet', () => {
		const [match] = searchTable(columns, rows, 'fixed').matches;
		expect(match).toMatchObject({ rowIndex: 2, columnIndex: 1 });
	});

	it('counts a row once even when several of its cells match', () => {
		const result = searchTable(columns, rows, 'a');
		expect(result.matches.length).toBeGreaterThan(result.rowCount);
		expect(result.rowCount).toBe(4);
	});

	it('limits the search to one column when asked', () => {
		const result = searchTable(columns, rows, 'approve', { columnId: 'out' });
		expect(result.matches.map((match) => match.rowId)).toEqual(['r2', 'r3']);
		expect(searchTable(columns, rows, 'approve', { columnId: 'msg' }).matches).toEqual([]);
	});

	it('indexes matches by cell for rendering', () => {
		const result = searchTable(columns, rows, 'kovacs');
		expect(result.byCell.get(cellKey('r1', 'name'))?.ranges).toEqual([{ start: 6, end: 12 }]);
		expect(result.byCell.has(cellKey('r1', 'msg'))).toBe(false);
	});

	it('treats a blank query as no search at all', () => {
		expect(searchTable(columns, rows, '   ').matches).toEqual([]);
	});

	it('trims the query before matching', () => {
		expect(searchTable(columns, rows, '  reject ').matches).toHaveLength(1);
	});

	it('returns nothing when the chosen column is gone', () => {
		expect(searchTable(columns, rows, 'a', { columnId: 'missing' }).matches).toEqual([]);
	});
});

describe('splitByRanges', () => {
	it('splits a value into plain and highlighted pieces', () => {
		expect(splitByRanges('Billing fixed', [{ start: 8, end: 13 }])).toEqual([
			{ text: 'Billing ', hit: false },
			{ text: 'fixed', hit: true }
		]);
	});

	it('returns the whole value when nothing matched', () => {
		expect(splitByRanges('Billing', [])).toEqual([{ text: 'Billing', hit: false }]);
	});
});

describe('excerpt', () => {
	const long =
		'Renewal quote came in 38 percent above last year with no notice and no change in seat count.';

	it('leaves a value alone when the match is already near the start', () => {
		const ranges = findRanges(long, 'renewal');
		expect(excerpt(long, ranges)).toEqual({ text: long, ranges });
	});

	it('starts the visible text just before a match deep in the value', () => {
		const ranges = findRanges(long, 'seat');
		const shown = excerpt(long, ranges);
		expect(shown.text.startsWith('\u2026')).toBe(true);
		const [range] = shown.ranges;
		expect(shown.text.slice(range.start, range.end)).toBe('seat');
		expect(range.start).toBeLessThan(20);
	});

	it('cuts at a word boundary when one is close', () => {
		const shown = excerpt(long, findRanges(long, 'seat'));
		expect(shown.text).toBe('\u2026change in seat count.');
	});
});

describe('stepIndex', () => {
	it('starts at the first match going forward and the last going back', () => {
		expect(stepIndex(-1, 1, 5)).toBe(0);
		expect(stepIndex(-1, -1, 5)).toBe(4);
	});

	it('wraps around both ends', () => {
		expect(stepIndex(4, 1, 5)).toBe(0);
		expect(stepIndex(0, -1, 5)).toBe(4);
	});

	it('has nowhere to go without matches', () => {
		expect(stepIndex(0, 1, 0)).toBe(-1);
	});
});
