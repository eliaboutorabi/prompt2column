/**
 * Turns an OutputSpec into the JSON schema Ollama constrains generation with,
 * plus the system prompt and the parser that pulls a clean cell value back out.
 *
 * Everything is wrapped in a single-property object because Ollama's structured
 * output requires an object at the root.
 */
import type { OutputSpec } from './types';

export interface JsonSchema {
	type: string;
	properties: Record<string, unknown>;
	required: string[];
	additionalProperties?: boolean;
}

export function buildSchema(spec: OutputSpec): JsonSchema {
	let value: Record<string, unknown>;
	switch (spec.kind) {
		case 'choice':
			value = spec.allowOther
				? { type: 'string' }
				: { type: 'string', enum: spec.choices.length ? spec.choices : ['unknown'] };
			break;
		case 'number':
			value = { type: spec.integer ? 'integer' : 'number' };
			if (spec.min !== null) value.minimum = spec.min;
			if (spec.max !== null) value.maximum = spec.max;
			break;
		case 'boolean':
			value = { type: 'boolean' };
			break;
		default:
			value = { type: 'string' };
	}
	return {
		type: 'object',
		properties: { value },
		required: ['value'],
		additionalProperties: false
	};
}

export function describeOutput(spec: OutputSpec): string {
	switch (spec.kind) {
		case 'choice':
			return spec.choices.length
				? `exactly one of these labels: ${spec.choices.join(', ')}`
				: 'a single short label';
		case 'number': {
			const kind = spec.integer ? 'whole number' : 'number';
			if (spec.min !== null && spec.max !== null)
				return `a ${kind} between ${spec.min} and ${spec.max}`;
			if (spec.min !== null) return `a ${kind} of at least ${spec.min}`;
			if (spec.max !== null) return `a ${kind} of at most ${spec.max}`;
			return `a ${kind}`;
		}
		case 'boolean':
			return `true or false, where true means "${spec.trueLabel}" and false means "${spec.falseLabel}"`;
		default:
			return spec.maxWords ? `plain text of at most ${spec.maxWords} words` : 'plain text';
	}
}

export function buildSystemPrompt(
	spec: OutputSpec,
	targetColumnName: string,
	instructions: string
): string {
	const column = targetColumnName.trim() || 'the new column';
	const lines = [
		`You fill in the "${column}" cell for one row of a spreadsheet.`,
		`Read the row data in the user message and reply with ${describeOutput(spec)}.`,
		'Reply with JSON matching the schema and nothing else.',
		'No greeting, no preamble, no explanation, no markdown, no quotes around the value.'
	];
	if (spec.kind === 'choice' && spec.choices.length && !spec.allowOther) {
		lines.push(`Copy one label exactly as written: ${spec.choices.join(' | ')}.`);
	}
	if (spec.kind === 'text' && spec.maxWords) {
		lines.push(`Stay under ${spec.maxWords} words. Write one continuous line without line breaks.`);
	}
	const extra = instructions.trim();
	if (extra) lines.push(extra);
	return lines.join('\n');
}

export type CoerceResult = { ok: true; value: string } | { ok: false; reason: string };

const FENCE_RE = /^```[a-z]*\n?([\s\S]*?)\n?```$/i;

/** Pulls the `value` field out of a model reply, tolerating stray text. */
export function extractRaw(content: string): unknown {
	let text = content.trim();
	const fenced = text.match(FENCE_RE);
	if (fenced) text = fenced[1].trim();
	const direct = tryParse(text);
	if (direct !== undefined) return unwrap(direct);
	const first = text.indexOf('{');
	const last = text.lastIndexOf('}');
	if (first !== -1 && last > first) {
		const embedded = tryParse(text.slice(first, last + 1));
		if (embedded !== undefined) return unwrap(embedded);
	}
	return text;
}

function tryParse(text: string): unknown {
	if (text === '') return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function unwrap(parsed: unknown): unknown {
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		const record = parsed as Record<string, unknown>;
		if ('value' in record) return record.value;
		const keys = Object.keys(record);
		if (keys.length === 1) return record[keys[0]];
	}
	return parsed;
}

export function coerce(spec: OutputSpec, content: string): CoerceResult {
	const raw = extractRaw(content);
	switch (spec.kind) {
		case 'choice':
			return coerceChoice(spec, raw);
		case 'number':
			return coerceNumber(spec, raw);
		case 'boolean':
			return coerceBoolean(spec, raw);
		default:
			return coerceText(spec, raw);
	}
}

function asText(raw: unknown): string {
	if (raw === null || raw === undefined) return '';
	if (typeof raw === 'string') return raw;
	if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
	return JSON.stringify(raw);
}

function stripQuotes(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length >= 2 && /^["'“‘]/.test(trimmed) && /["'”’]$/.test(trimmed)) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function coerceText(spec: OutputSpec, raw: unknown): CoerceResult {
	const value = stripQuotes(asText(raw))
		.replace(/\s*\n\s*/g, ' ')
		.trim();
	if (value === '') return { ok: false, reason: 'The model returned an empty value.' };
	return { ok: true, value };
}

function coerceChoice(spec: OutputSpec, raw: unknown): CoerceResult {
	const text = stripQuotes(asText(raw));
	if (text === '') return { ok: false, reason: 'The model returned an empty value.' };
	if (!spec.choices.length) return { ok: true, value: text };
	const lower = text.toLowerCase();
	const exact = spec.choices.find((c) => c.toLowerCase() === lower);
	if (exact) return { ok: true, value: exact };
	const contained = spec.choices.find(
		(c) => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)
	);
	if (contained) return { ok: true, value: contained };
	if (spec.allowOther) return { ok: true, value: text };
	return {
		ok: false,
		reason: `"${truncate(text)}" is not one of the allowed labels.`
	};
}

function coerceNumber(spec: OutputSpec, raw: unknown): CoerceResult {
	const text = stripQuotes(asText(raw));
	const match = text.match(/-?\d+(?:[.,]\d+)?/);
	if (!match) return { ok: false, reason: `"${truncate(text)}" is not a number.` };
	let num = Number(match[0].replace(',', '.'));
	if (!Number.isFinite(num)) return { ok: false, reason: `"${truncate(text)}" is not a number.` };
	if (spec.integer) num = Math.round(num);
	if (spec.min !== null && num < spec.min)
		return { ok: false, reason: `${num} is below the minimum of ${spec.min}.` };
	if (spec.max !== null && num > spec.max)
		return { ok: false, reason: `${num} is above the maximum of ${spec.max}.` };
	return { ok: true, value: String(num) };
}

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'approve', 'approved', 'accept', 'pass']);
const FALSY = new Set(['false', 'no', 'n', '0', 'reject', 'rejected', 'deny', 'denied', 'fail']);

function coerceBoolean(spec: OutputSpec, raw: unknown): CoerceResult {
	if (typeof raw === 'boolean') return { ok: true, value: raw ? spec.trueLabel : spec.falseLabel };
	const text = stripQuotes(asText(raw)).toLowerCase();
	if (text === spec.trueLabel.toLowerCase()) return { ok: true, value: spec.trueLabel };
	if (text === spec.falseLabel.toLowerCase()) return { ok: true, value: spec.falseLabel };
	if (TRUTHY.has(text)) return { ok: true, value: spec.trueLabel };
	if (FALSY.has(text)) return { ok: true, value: spec.falseLabel };
	return { ok: false, reason: `"${truncate(text)}" is not a yes or no answer.` };
}

function truncate(text: string, limit = 40): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}
