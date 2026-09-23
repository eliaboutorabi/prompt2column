/**
 * Find-in-sheet. The grid only renders the rows on screen, so the browser's own
 * find cannot see most of a large sheet; this searches the data instead.
 *
 * Matching ignores case and accents, so "kovacs" finds "Kovács". Ranges are
 * reported against the original text so the grid can highlight them in place.
 */
import type { Column, ColumnId, Row, RowId } from './types';

export interface Range {
	start: number;
	end: number;
}

export interface CellMatch {
	rowId: RowId;
	columnId: ColumnId;
	/** Position of the row in the sheet, 0-based. */
	rowIndex: number;
	/** Position of the column in the sheet, 0-based. */
	columnIndex: number;
	ranges: Range[];
}

export interface SearchResult {
	/** Matching cells in reading order: row by row, left to right. */
	matches: CellMatch[];
	/** `${rowId}\u0000${columnId}` to the match, for per-cell lookups while rendering. */
	byCell: Map<string, CellMatch>;
	/** How many distinct rows hold at least one match. */
	rowCount: number;
}

export interface SearchOptions {
	/** Restrict the search to one column. Null searches every column. */
	columnId?: ColumnId | null;
}

const EMPTY: SearchResult = { matches: [], byCell: new Map(), rowCount: 0 };
const ASCII = /^[\x20-\x7e]*$/;
const MARKS = /\p{M}/u;

export function cellKey(rowId: RowId, columnId: ColumnId): string {
	return `${rowId}\u0000${columnId}`;
}

interface Folded {
	text: string;
	/** For each character of `text`, the index of the source character it came from. */
	source: number[] | null;
}

/** Lowercases and strips accents, remembering where each character came from. */
export function fold(value: string): Folded {
	// Printable ASCII folds one character to one character, so no map is needed.
	if (ASCII.test(value)) return { text: value.toLowerCase(), source: null };
	let text = '';
	const source: number[] = [];
	let index = 0;
	for (const char of value) {
		for (const part of char.normalize('NFD').toLowerCase()) {
			if (MARKS.test(part)) continue;
			text += part;
			for (let i = 0; i < part.length; i += 1) source.push(index);
		}
		index += char.length;
	}
	return { text, source };
}

/** Every non-overlapping occurrence of an already-folded needle in `value`. */
export function findRanges(value: string, needle: string): Range[] {
	if (!needle || !value) return [];
	const folded = fold(value);
	const ranges: Range[] = [];
	let from = 0;
	while (from <= folded.text.length - needle.length) {
		const at = folded.text.indexOf(needle, from);
		if (at === -1) break;
		const endAt = at + needle.length;
		if (folded.source) {
			const last = folded.source[endAt - 1];
			ranges.push({
				start: folded.source[at],
				end: last + (value.codePointAt(last)! > 0xffff ? 2 : 1)
			});
		} else {
			ranges.push({ start: at, end: endAt });
		}
		from = endAt;
	}
	return ranges;
}

export function normalizeQuery(query: string): string {
	return fold(query.trim()).text;
}

export function searchTable(
	columns: Column[],
	rows: Row[],
	query: string,
	options: SearchOptions = {}
): SearchResult {
	const needle = normalizeQuery(query);
	if (!needle) return EMPTY;
	const targets = columns
		.map((column, columnIndex) => ({ column, columnIndex }))
		.filter(({ column }) => !options.columnId || column.id === options.columnId);
	if (!targets.length) return EMPTY;

	const matches: CellMatch[] = [];
	const byCell = new Map<string, CellMatch>();
	let rowCount = 0;
	rows.forEach((row, rowIndex) => {
		let hit = false;
		for (const { column, columnIndex } of targets) {
			const ranges = findRanges(row.cells[column.id] ?? '', needle);
			if (!ranges.length) continue;
			const match: CellMatch = {
				rowId: row.id,
				columnId: column.id,
				rowIndex,
				columnIndex,
				ranges
			};
			matches.push(match);
			byCell.set(cellKey(row.id, column.id), match);
			hit = true;
		}
		if (hit) rowCount += 1;
	});
	return { matches, byCell, rowCount };
}

export type Piece = { text: string; hit: boolean };

/** Cuts a cell value into plain and highlighted pieces for rendering. */
export function splitByRanges(value: string, ranges: Range[]): Piece[] {
	if (!ranges.length) return [{ text: value, hit: false }];
	const pieces: Piece[] = [];
	let cursor = 0;
	for (const { start, end } of ranges) {
		if (start > cursor) pieces.push({ text: value.slice(cursor, start), hit: false });
		pieces.push({ text: value.slice(start, end), hit: true });
		cursor = end;
	}
	if (cursor < value.length) pieces.push({ text: value.slice(cursor), hit: false });
	return pieces;
}

/**
 * Cells are one line with an ellipsis, so a match deep inside a long value would
 * be cut off. This shifts the visible text to start just before the first match.
 */
export function excerpt(
	value: string,
	ranges: Range[],
	lead = 12
): { text: string; ranges: Range[] } {
	const first = ranges[0];
	if (!first || first.start <= lead + 8) return { text: value, ranges };
	let from = first.start - lead;
	// Start on a word rather than halfway through one.
	const space = value.indexOf(' ', from);
	if (space !== -1 && space < first.start) from = space + 1;
	const shift = from - 1;
	return {
		text: `…${value.slice(from)}`,
		ranges: ranges.map(({ start, end }) => ({ start: start - shift, end: end - shift }))
	};
}

/** Steps through matches, wrapping at both ends. */
export function stepIndex(current: number, step: number, total: number): number {
	if (total <= 0) return -1;
	if (current < 0) return step >= 0 ? 0 : total - 1;
	return (((current + step) % total) + total) % total;
}
