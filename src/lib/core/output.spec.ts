import { describe, expect, it } from 'vitest';
import { buildSchema, buildSystemPrompt, coerce, extractRaw } from './output';
import { defaultOutputSpec, type OutputSpec } from './types';

const choice = (over: Partial<OutputSpec> = {}): OutputSpec => ({
	...defaultOutputSpec(),
	kind: 'choice',
	choices: ['positive', 'neutral', 'negative'],
	...over
});

describe('buildSchema', () => {
	it('constrains a label to the allowed list', () => {
		expect(buildSchema(choice()).properties.value).toEqual({
			type: 'string',
			enum: ['positive', 'neutral', 'negative']
		});
	});

	it('drops the list when other answers are allowed', () => {
		expect(buildSchema(choice({ allowOther: true })).properties.value).toEqual({ type: 'string' });
	});

	it('carries number bounds into the schema', () => {
		const spec: OutputSpec = {
			...defaultOutputSpec(),
			kind: 'number',
			min: 1,
			max: 5,
			integer: true
		};
		expect(buildSchema(spec).properties.value).toEqual({ type: 'integer', minimum: 1, maximum: 5 });
	});

	it('always requires the value field', () => {
		expect(buildSchema(defaultOutputSpec()).required).toEqual(['value']);
	});
});

describe('buildSystemPrompt', () => {
	it('names the column and bans chatter', () => {
		const prompt = buildSystemPrompt(choice(), 'Sentiment', '');
		expect(prompt).toContain('"Sentiment"');
		expect(prompt).toContain('No greeting');
		expect(prompt).toContain('positive | neutral | negative');
	});

	it('appends the user rules last', () => {
		const prompt = buildSystemPrompt(defaultOutputSpec(), 'Summary', 'Keep names intact.');
		expect(prompt.trim().endsWith('Keep names intact.')).toBe(true);
	});
});

describe('extractRaw', () => {
	it('unwraps the value field', () => {
		expect(extractRaw('{"value": "negative"}')).toBe('negative');
	});

	it('strips a code fence', () => {
		expect(extractRaw('```json\n{"value": 4}\n```')).toBe(4);
	});

	it('finds JSON buried in prose', () => {
		expect(extractRaw('Sure! {"value": "neutral"} hope that helps')).toBe('neutral');
	});

	it('falls back to the raw text', () => {
		expect(extractRaw('negative')).toBe('negative');
	});
});

describe('coerce', () => {
	it('accepts a label from the list', () => {
		expect(coerce(choice(), '{"value":"negative"}')).toEqual({ ok: true, value: 'negative' });
	});

	it('repairs casing', () => {
		expect(coerce(choice(), 'Negative')).toEqual({ ok: true, value: 'negative' });
	});

	it('pulls a label out of a sentence', () => {
		expect(coerce(choice(), 'The sentiment is negative.')).toEqual({
			ok: true,
			value: 'negative'
		});
	});

	it('rejects a label outside the list', () => {
		const result = coerce(choice(), '{"value":"furious"}');
		expect(result.ok).toBe(false);
	});

	it('keeps an outside label when the spec allows it', () => {
		expect(coerce(choice({ allowOther: true }), '{"value":"furious"}')).toEqual({
			ok: true,
			value: 'furious'
		});
	});

	it('reads a boolean into the configured labels', () => {
		const spec: OutputSpec = { ...defaultOutputSpec(), kind: 'boolean' };
		expect(coerce(spec, '{"value": true}')).toEqual({ ok: true, value: 'Approve' });
		expect(coerce(spec, '{"value": false}')).toEqual({ ok: true, value: 'Reject' });
		expect(coerce(spec, 'yes')).toEqual({ ok: true, value: 'Approve' });
	});

	it('rejects a boolean answer it cannot read', () => {
		const spec: OutputSpec = { ...defaultOutputSpec(), kind: 'boolean' };
		expect(coerce(spec, 'maybe next quarter').ok).toBe(false);
	});

	it('parses a number out of stray text', () => {
		const spec: OutputSpec = {
			...defaultOutputSpec(),
			kind: 'number',
			min: 1,
			max: 5,
			integer: true
		};
		expect(coerce(spec, 'I would say 4 out of 5')).toEqual({ ok: true, value: '4' });
	});

	it('enforces number bounds', () => {
		const spec: OutputSpec = {
			...defaultOutputSpec(),
			kind: 'number',
			min: 1,
			max: 5,
			integer: true
		};
		expect(coerce(spec, '{"value": 9}').ok).toBe(false);
	});

	it('rounds when whole numbers are required', () => {
		const spec: OutputSpec = {
			...defaultOutputSpec(),
			kind: 'number',
			min: null,
			max: null,
			integer: true
		};
		expect(coerce(spec, '{"value": 3.6}')).toEqual({ ok: true, value: '4' });
	});

	it('flattens free text onto one line and drops wrapping quotes', () => {
		expect(coerce(defaultOutputSpec(), '"A short\n  summary."')).toEqual({
			ok: true,
			value: 'A short summary.'
		});
	});

	it('rejects an empty answer', () => {
		expect(coerce(defaultOutputSpec(), '{"value": ""}').ok).toBe(false);
	});
});
