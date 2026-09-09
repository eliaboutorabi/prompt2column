import { describe, expect, it } from 'vitest';
import { exportFilename, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
	it('reads the header as columns and the rest as rows', () => {
		const table = parseCsv('Name,Role\nInes,Design\nTomasz,Engineering\n');
		expect(table.columns.map((column) => column.name)).toEqual(['Name', 'Role']);
		expect(table.rows).toHaveLength(2);
		expect(table.rows[0].cells[table.columns[0].id]).toBe('Ines');
	});

	it('keeps commas and quotes inside quoted fields', () => {
		const table = parseCsv('Message\n"Charged twice, then said ""no refund"""\n');
		expect(table.rows[0].cells[table.columns[0].id]).toBe('Charged twice, then said "no refund"');
	});

	it('reads the last row when the file has no trailing newline', () => {
		expect(parseCsv('A\n1\n2').rows).toHaveLength(2);
	});

	it('skips blank lines', () => {
		expect(parseCsv('A\n1\n\n\n2\n').rows).toHaveLength(2);
	});

	it('names an empty header cell', () => {
		expect(parseCsv('A,,C\n1,2,3').columns[1].name).toBe('Column 2');
	});

	it('renames a duplicate header and says so', () => {
		const table = parseCsv('Name,Name\n1,2');
		expect(table.columns.map((column) => column.name)).toEqual(['Name', 'Name 2']);
		expect(table.warnings.join(' ')).toContain('Duplicate header');
	});

	it('pads short rows with empty cells', () => {
		const table = parseCsv('A,B,C\n1\n');
		expect(table.rows[0].cells[table.columns[2].id]).toBe('');
	});

	it('reports a file with no rows', () => {
		expect(parseCsv('').warnings).toContain('The file has no rows.');
	});
});

describe('toCsv', () => {
	it('round-trips through a parse without losing anything', () => {
		const source = 'Name,Note\nInes,"Said ""later"", then left"\nTomasz,Fine\n';
		const table = parseCsv(source);
		const written = toCsv(table.columns, table.rows);
		const again = parseCsv(written);
		expect(again.columns.map((column) => column.name)).toEqual(['Name', 'Note']);
		expect(again.rows[0].cells[again.columns[1].id]).toBe('Said "later", then left');
	});

	it('writes generated columns in place', () => {
		const table = parseCsv('Name\nInes\n');
		const column = { id: 'gen', name: 'Sentiment', generated: true };
		table.columns.push(column);
		table.rows[0].cells.gen = 'positive';
		expect(toCsv(table.columns, table.rows)).toBe('Name,Sentiment\nInes,positive');
	});
});

describe('exportFilename', () => {
	it('slugs the project name', () => {
		expect(exportFilename('Support tickets', 'support-tickets.csv')).toBe(
			'support-tickets-enriched.csv'
		);
	});

	it('falls back to the source file name', () => {
		expect(exportFilename('', 'Q3 report.csv')).toBe('q3-report-enriched.csv');
	});

	it('never returns an empty base name', () => {
		expect(exportFilename('***', null)).toBe('spreadsheet-enriched.csv');
	});
});
