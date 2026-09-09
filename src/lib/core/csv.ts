/** CSV import and export. Excel support will slot in beside this module. */
import Papa from 'papaparse';
import { uid, type Column, type Row, type Table } from './types';

export interface ParseReport extends Table {
	/** Non-fatal problems worth showing the user. */
	warnings: string[];
}

export function parseCsv(text: string): ParseReport {
	const result = Papa.parse<string[]>(text, {
		skipEmptyLines: 'greedy',
		header: false
	});
	const warnings: string[] = [];
	for (const error of result.errors.slice(0, 3)) {
		warnings.push(`Row ${(error.row ?? 0) + 1}: ${error.message}`);
	}
	const grid = result.data.filter((line) => line.some((cell) => (cell ?? '').trim() !== ''));
	if (!grid.length) return { columns: [], rows: [], warnings: ['The file has no rows.'] };

	const header = grid[0];
	const columns: Column[] = [];
	const used = new Set<string>();
	header.forEach((raw, index) => {
		let name = (raw ?? '').trim() || `Column ${index + 1}`;
		if (used.has(name.toLowerCase())) {
			let suffix = 2;
			while (used.has(`${name} ${suffix}`.toLowerCase())) suffix += 1;
			warnings.push(`Duplicate header "${name}" renamed to "${name} ${suffix}".`);
			name = `${name} ${suffix}`;
		}
		used.add(name.toLowerCase());
		columns.push({ id: uid('col'), name, generated: false });
	});

	const rows: Row[] = [];
	for (let i = 1; i < grid.length; i += 1) {
		const line = grid[i];
		const cells: Record<string, string> = {};
		columns.forEach((column, index) => {
			cells[column.id] = (line[index] ?? '').trim();
		});
		if (line.length > columns.length && warnings.length < 6) {
			warnings.push(`Row ${i + 1} has more values than headers. Extra values were dropped.`);
		}
		rows.push({ id: uid('row'), cells });
	}
	return { columns, rows, warnings };
}

export function toCsv(columns: Column[], rows: Row[]): string {
	const data = rows.map((row) => columns.map((column) => row.cells[column.id] ?? ''));
	return Papa.unparse({ fields: columns.map((c) => c.name), data }, { newline: '\n' });
}

export function downloadCsv(filename: string, csv: string): void {
	const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(projectName: string, sourceName: string | null): string {
	const base = (projectName || sourceName || 'spreadsheet')
		.replace(/\.[a-z]+$/i, '')
		.replace(/[^\w -]+/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase();
	return `${base || 'spreadsheet'}-enriched.csv`;
}
