import { describe, expect, it } from 'vitest';
import { exportFilename, serialize, toJson } from './export';
import { parseCsv } from './csv';
import type { Column, Row } from './types';

const columns: Column[] = [
	{ id: 'c1', name: 'Request', generated: false },
	{ id: 'c2', name: 'Amount EUR', generated: false },
	{ id: 'c3', name: 'Decision', generated: true }
];

const rows: Row[] = [
	{ id: 'r1', cells: { c1: 'EXP-0912', c2: '240', c3: 'Approve' } },
	{ id: 'r2', cells: { c1: 'EXP-0913', c2: '1850', c3: '' } }
];

describe('toJson', () => {
	it('writes one object per row, keyed by column name', () => {
		expect(JSON.parse(toJson(columns, rows))).toEqual([
			{ Request: 'EXP-0912', 'Amount EUR': '240', Decision: 'Approve' },
			{ Request: 'EXP-0913', 'Amount EUR': '1850', Decision: '' }
		]);
	});

	it('keeps every value a string, as it appears in the sheet', () => {
		const table = parseCsv('Code,Count\n007,12\n');
		const [row] = JSON.parse(toJson(table.columns, table.rows));
		expect(row).toEqual({ Code: '007', Count: '12' });
	});

	it('writes keys in column order, even for names that look like numbers', () => {
		const numbered: Column[] = [
			{ id: 'a', name: 'Name', generated: false },
			{ id: 'b', name: '2024', generated: false },
			{ id: 'c', name: '10', generated: false }
		];
		const text = toJson(numbered, [{ id: 'r', cells: { a: 'Ines', b: 'x', c: 'y' } }]);
		const keys = [...text.matchAll(/^ {4}"([^"]+)":/gm)].map((match) => match[1]);
		expect(keys).toEqual(['Name', '2024', '10']);
	});

	it('writes a missing cell as an empty string', () => {
		const [row] = JSON.parse(toJson(columns, [{ id: 'r', cells: { c1: 'EXP-1' } }]));
		expect(row).toEqual({ Request: 'EXP-1', 'Amount EUR': '', Decision: '' });
	});

	it('escapes quotes, line breaks and backslashes', () => {
		const tricky = 'Said "no refund",\nthen left C:\\temp';
		const [row] = JSON.parse(toJson(columns, [{ id: 'r', cells: { c1: tricky } }]));
		expect(row.Request).toBe(tricky);
	});

	it('keeps accented text as written', () => {
		const text = toJson(columns, [{ id: 'r', cells: { c1: 'Marta Kovács' } }]);
		expect(text).toContain('"Marta Kovács"');
	});

	it('is indented for reading and ends with a newline', () => {
		const text = toJson(columns, rows);
		expect(text.startsWith('[\n  {\n    "Request": "EXP-0912",')).toBe(true);
		expect(text.endsWith(']\n')).toBe(true);
	});

	it('writes an empty array for a sheet with no rows', () => {
		expect(JSON.parse(toJson(columns, []))).toEqual([]);
	});

	it('writes empty objects when there are no columns', () => {
		expect(JSON.parse(toJson([], rows))).toEqual([{}, {}]);
	});
});

describe('serialize', () => {
	it('picks the writer for the format', () => {
		expect(serialize('csv', columns, rows).split('\n')[0]).toBe('Request,Amount EUR,Decision');
		expect(JSON.parse(serialize('json', columns, rows))).toHaveLength(2);
	});
});

describe('exportFilename', () => {
	it('slugs the project name', () => {
		expect(exportFilename('Support tickets', 'support-tickets.csv')).toBe(
			'support-tickets-enriched.csv'
		);
	});

	it('uses the extension of the chosen format', () => {
		expect(exportFilename('Support tickets', null, 'json')).toBe('support-tickets-enriched.json');
	});

	it('falls back to the source file name', () => {
		expect(exportFilename('', 'Q3 report.csv')).toBe('q3-report-enriched.csv');
	});

	it('never returns an empty base name', () => {
		expect(exportFilename('***', null, 'json')).toBe('spreadsheet-enriched.json');
	});
});
