/** Tallies the values in one column: how a classify or approve/reject run came out. */
import type { ColumnId, Row, RowId } from './types';

export interface ValueCount {
	value: string;
	count: number;
	rowIds: RowId[];
}

export interface ColumnCounts {
	/** Every row in the sheet, empty cells included. */
	total: number;
	/** The most common values, most frequent first. */
	values: ValueCount[];
	/** Rows whose cell is blank, or null when there are none. */
	empty: ValueCount | null;
	/** Values past the limit, rolled up so the list stays short. */
	others: { distinct: number; count: number };
}

/**
 * Values are compared exactly, after trimming, so "Email" and "email" stay apart:
 * the tally reports what is in the sheet rather than guessing what was meant.
 */
export function countValues(rows: Row[], columnId: ColumnId, limit = 8): ColumnCounts {
	const byValue = new Map<string, ValueCount>();
	const emptyIds: RowId[] = [];
	for (const row of rows) {
		const value = (row.cells[columnId] ?? '').trim();
		if (!value) {
			emptyIds.push(row.id);
			continue;
		}
		const entry = byValue.get(value);
		if (entry) {
			entry.count += 1;
			entry.rowIds.push(row.id);
		} else {
			byValue.set(value, { value, count: 1, rowIds: [row.id] });
		}
	}
	const sorted = [...byValue.values()].sort(
		(a, b) => b.count - a.count || a.value.localeCompare(b.value)
	);
	const rest = sorted.slice(limit);
	return {
		total: rows.length,
		values: sorted.slice(0, limit),
		empty: emptyIds.length ? { value: '', count: emptyIds.length, rowIds: emptyIds } : null,
		others: { distinct: rest.length, count: rest.reduce((sum, entry) => sum + entry.count, 0) }
	};
}

/** A share of the sheet as a whole percentage, never rounding a real count down to 0%. */
export function formatShare(count: number, total: number): string {
	if (!total || !count) return '0%';
	const percent = (count / total) * 100;
	if (percent < 1) return '<1%';
	return `${Math.round(percent)}%`;
}
