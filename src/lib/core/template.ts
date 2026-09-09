/**
 * Prompt template language.
 *
 * A template is plain text with `{{Column Name}}` references. Names are matched
 * against the spreadsheet header case-insensitively and with outer whitespace
 * trimmed, so `{{ email }}` and `{{Email}}` resolve to the same column.
 */
import type { Column, Row } from './types';

export const TOKEN_RE = /\{\{([^{}]*)\}\}/g;

export interface TokenRef {
	/** Name as typed, trimmed. */
	name: string;
	/** Index of the opening brace in the template. */
	start: number;
	/** Index just past the closing brace. */
	end: number;
}

export type Segment =
	{ type: 'text'; value: string } | { type: 'token'; name: string; start: number; end: number };

export function parseTemplate(template: string): Segment[] {
	const segments: Segment[] = [];
	let cursor = 0;
	for (const match of template.matchAll(TOKEN_RE)) {
		const start = match.index ?? 0;
		if (start > cursor) segments.push({ type: 'text', value: template.slice(cursor, start) });
		segments.push({
			type: 'token',
			name: match[1].trim(),
			start,
			end: start + match[0].length
		});
		cursor = start + match[0].length;
	}
	if (cursor < template.length) segments.push({ type: 'text', value: template.slice(cursor) });
	return segments;
}

export function extractTokens(template: string): TokenRef[] {
	return parseTemplate(template)
		.filter((s): s is Extract<Segment, { type: 'token' }> => s.type === 'token')
		.map(({ name, start, end }) => ({ name, start, end }));
}

export function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

export function findColumn(columns: Column[], name: string): Column | undefined {
	const wanted = normalizeName(name);
	return columns.find((c) => normalizeName(c.name) === wanted);
}

export interface TemplateIssues {
	/** Referenced names with no matching column. */
	unknown: string[];
	/** True when the template has no column reference at all. */
	hasNoTokens: boolean;
	/** `{{` with no closing braces after it. */
	unclosed: boolean;
}

export function validateTemplate(template: string, columns: Column[]): TemplateIssues {
	const tokens = extractTokens(template);
	const unknown: string[] = [];
	for (const token of tokens) {
		if (token.name === '') {
			if (!unknown.includes('')) unknown.push('');
			continue;
		}
		if (!findColumn(columns, token.name) && !unknown.includes(token.name)) unknown.push(token.name);
	}
	const tail = template.slice(tokens.length ? tokens[tokens.length - 1].end : 0);
	return { unknown, hasNoTokens: tokens.length === 0, unclosed: tail.includes('{{') };
}

export interface RenderResult {
	text: string;
	/** Referenced columns that exist but hold an empty cell for this row. */
	emptyColumns: string[];
	/** Referenced names with no matching column. */
	unknownColumns: string[];
}

export function renderTemplate(template: string, row: Row, columns: Column[]): RenderResult {
	const emptyColumns: string[] = [];
	const unknownColumns: string[] = [];
	let text = '';
	for (const segment of parseTemplate(template)) {
		if (segment.type === 'text') {
			text += segment.value;
			continue;
		}
		const column = findColumn(columns, segment.name);
		if (!column) {
			unknownColumns.push(segment.name);
			continue;
		}
		const value = (row.cells[column.id] ?? '').trim();
		if (value === '') emptyColumns.push(column.name);
		text += value;
	}
	return { text, emptyColumns, unknownColumns };
}

/** Keeps saved templates working when a column is renamed. */
export function renameInTemplate(template: string, oldName: string, newName: string): string {
	const wanted = normalizeName(oldName);
	return template.replace(TOKEN_RE, (raw, inner: string) =>
		normalizeName(inner) === wanted ? `{{${newName}}}` : raw
	);
}

export interface AutocompleteQuery {
	/** Text typed between `{{` and the caret. */
	query: string;
	/** Index of the opening `{{`. */
	start: number;
	/** Caret index, where the replacement ends. */
	end: number;
}

/**
 * Detects an open `{{` reference immediately before the caret so the editor can
 * offer column suggestions. Returns null when the caret is not inside one.
 */
export function autocompleteContext(template: string, caret: number): AutocompleteQuery | null {
	const before = template.slice(0, caret);
	const open = before.lastIndexOf('{{');
	if (open === -1) return null;
	const inner = before.slice(open + 2);
	if (inner.includes('}}') || inner.includes('{{') || inner.includes('\n')) return null;
	return { query: inner.trim(), start: open, end: caret };
}

export function rankColumns(columns: Column[], query: string): Column[] {
	const q = normalizeName(query);
	if (q === '') return columns.slice();
	const scored: Array<{ column: Column; score: number }> = [];
	for (const column of columns) {
		const name = normalizeName(column.name);
		let score = -1;
		if (name === q) score = 0;
		else if (name.startsWith(q)) score = 1;
		else if (name.includes(q)) score = 2;
		else if (subsequence(name, q)) score = 3;
		if (score >= 0) scored.push({ column, score });
	}
	return scored
		.sort((a, b) => a.score - b.score || a.column.name.localeCompare(b.column.name))
		.map((s) => s.column);
}

function subsequence(haystack: string, needle: string): boolean {
	let i = 0;
	for (const char of haystack) {
		if (char === needle[i]) i += 1;
		if (i === needle.length) return true;
	}
	return needle.length === 0;
}

/** Inserts a `{{Column}}` reference, replacing an in-progress one when present. */
export function insertReference(
	template: string,
	caret: number,
	columnName: string
): { text: string; caret: number } {
	const context = autocompleteContext(template, caret);
	const token = `{{${columnName}}}`;
	if (context) {
		const after = template.slice(context.end);
		const trimmedAfter = after.startsWith('}}') ? after.slice(2) : after;
		return {
			text: template.slice(0, context.start) + token + trimmedAfter,
			caret: context.start + token.length
		};
	}
	const before = template.slice(0, caret);
	const needsSpace = before.length > 0 && !/\s$/.test(before);
	const insert = (needsSpace ? ' ' : '') + token;
	return { text: before + insert + template.slice(caret), caret: caret + insert.length };
}
