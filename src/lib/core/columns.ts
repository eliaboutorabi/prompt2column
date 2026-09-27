/** What a column holds, so the grid can dress it: icons, alignment, answer labels. */
import { countValues } from './counts';
import type { Column, Row } from './types';

export type ColumnKind = 'generated' | 'number' | 'date' | 'text';

const NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/;
const DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;

/** Reads the first rows that have a value; a column is only a number or date if all of them are. */
export function detectKind(column: Column, rows: Row[], sample = 60): ColumnKind {
	if (column.generated) return 'generated';
	const values: string[] = [];
	for (const row of rows) {
		const value = (row.cells[column.id] ?? '').trim();
		if (value) values.push(value);
		if (values.length >= sample) break;
	}
	if (!values.length) return 'text';
	if (values.every((value) => NUMBER.test(value))) return 'number';
	if (values.every((value) => DATE.test(value))) return 'date';
	return 'text';
}

/**
 * A handful of short values that repeat, the shape a classify or approve/reject
 * run produces. Those read better as labels than as plain text.
 */
export function isCategorical(column: Column, rows: Row[], maxValues = 8, maxLength = 28): boolean {
	const counts = countValues(rows, column.id, maxValues);
	if (!counts.values.length || counts.others.distinct > 0) return false;
	if (counts.values.some((entry) => entry.value.length > maxLength)) return false;
	// One-off values everywhere is a list of names, not a set of labels.
	return counts.values.length <= 3 || counts.values.some((entry) => entry.count > 1);
}

const POSITIVE = /^(approve[ds]?|yes|positive|pass(ed)?|true|accept(ed)?|good|valid|high)$/i;
const NEGATIVE = /^(reject(ed)?|no|negative|fail(ed)?|false|den(y|ied)|bad|invalid|low)$/i;
const NEUTRAL = /^(neutral|maybe|mixed|unsure|unknown|partial|medium)$/i;
const OTHER_TONES = [1, 4, 5, 3];

/**
 * A colour for a label, 1 to 6. Words with an obvious meaning get the matching
 * colour (approve green, reject red, neutral amber); anything else gets a stable
 * colour from its spelling, so a label keeps its colour across rows and runs.
 */
export function labelTone(value: string): number {
	const word = value.trim();
	if (POSITIVE.test(word)) return 2;
	if (NEGATIVE.test(word)) return 6;
	if (NEUTRAL.test(word)) return 3;
	let hash = 0;
	for (const char of word.toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
	return OTHER_TONES[hash % OTHER_TONES.length];
}
