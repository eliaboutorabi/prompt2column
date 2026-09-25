/** Turns the sheet into a downloadable file. */
import { toCsv } from './csv';
import type { Column, Row } from './types';

export type ExportFormat = 'csv' | 'json';

const BOM = String.fromCharCode(0xfeff);

const MIME: Record<ExportFormat, string> = {
	csv: 'text/csv;charset=utf-8',
	json: 'application/json;charset=utf-8'
};

/**
 * One object per row, keyed by column name, in column order. Values stay strings,
 * exactly as they appear in the sheet, so IDs like "007" survive the trip.
 *
 * Built by hand rather than with JSON.stringify on objects, because objects list
 * integer-like keys ("2024") first and would scramble the column order.
 */
export function toJson(columns: Column[], rows: Row[]): string {
	if (!rows.length) return '[]\n';
	const keys = columns.map((column) => JSON.stringify(column.name));
	const lines = rows.map((row) => {
		const fields = columns.map(
			(column, index) => `    ${keys[index]}: ${JSON.stringify(row.cells[column.id] ?? '')}`
		);
		return fields.length ? `  {\n${fields.join(',\n')}\n  }` : '  {}';
	});
	return `[\n${lines.join(',\n')}\n]\n`;
}

export function serialize(format: ExportFormat, columns: Column[], rows: Row[]): string {
	return format === 'json' ? toJson(columns, rows) : toCsv(columns, rows);
}

export function exportFilename(
	projectName: string,
	sourceName: string | null,
	format: ExportFormat = 'csv'
): string {
	const base = (projectName || sourceName || 'spreadsheet')
		.replace(/\.[a-z]+$/i, '')
		.replace(/[^\w -]+/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase();
	return `${base || 'spreadsheet'}-enriched.${format}`;
}

export function downloadFile(filename: string, format: ExportFormat, content: string): void {
	// The byte order mark tells Excel the CSV is UTF-8, so accented names open intact.
	const body = format === 'csv' ? BOM + content : content;
	const url = URL.createObjectURL(new Blob([body], { type: MIME[format] }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
