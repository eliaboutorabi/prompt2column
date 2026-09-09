import { describe, expect, it } from 'vitest';
import {
	autocompleteContext,
	extractTokens,
	insertReference,
	parseTemplate,
	rankColumns,
	renameInTemplate,
	renderTemplate,
	validateTemplate
} from './template';
import type { Column, Row } from './types';

const columns: Column[] = [
	{ id: 'c1', name: 'Customer', generated: false },
	{ id: 'c2', name: 'Message', generated: false },
	{ id: 'c3', name: 'Raw notes', generated: false },
	{ id: 'c4', name: 'Sentiment', generated: true }
];

const row: Row = {
	id: 'r1',
	cells: { c1: 'Ines Moreau', c2: 'The export is wrong', c3: '', c4: '' }
};

describe('parseTemplate', () => {
	it('splits text and references in order', () => {
		expect(parseTemplate('Hi {{Customer}}!')).toEqual([
			{ type: 'text', value: 'Hi ' },
			{ type: 'token', name: 'Customer', start: 3, end: 15 },
			{ type: 'text', value: '!' }
		]);
	});

	it('trims whitespace inside the braces', () => {
		expect(extractTokens('{{  Raw notes  }}')[0].name).toBe('Raw notes');
	});

	it('leaves single braces alone', () => {
		expect(extractTokens('a { b } c')).toHaveLength(0);
	});
});

describe('renderTemplate', () => {
	it('substitutes cell values', () => {
		const result = renderTemplate('From {{Customer}}: {{Message}}', row, columns);
		expect(result.text).toBe('From Ines Moreau: The export is wrong');
		expect(result.unknownColumns).toEqual([]);
	});

	it('matches column names case insensitively', () => {
		expect(renderTemplate('{{ customer }}', row, columns).text).toBe('Ines Moreau');
	});

	it('reports empty cells without dropping the rest', () => {
		const result = renderTemplate('{{Customer}} {{Raw notes}}', row, columns);
		expect(result.text).toBe('Ines Moreau ');
		expect(result.emptyColumns).toEqual(['Raw notes']);
	});

	it('reports references that match no column', () => {
		const result = renderTemplate('{{Nope}}', row, columns);
		expect(result.unknownColumns).toEqual(['Nope']);
	});
});

describe('validateTemplate', () => {
	it('accepts a template whose references all resolve', () => {
		expect(validateTemplate('{{Customer}}', columns).unknown).toEqual([]);
	});

	it('collects each unknown name once', () => {
		expect(validateTemplate('{{Nope}} {{Nope}} {{Other}}', columns).unknown).toEqual([
			'Nope',
			'Other'
		]);
	});

	it('flags a template with no reference at all', () => {
		expect(validateTemplate('Say hello', columns).hasNoTokens).toBe(true);
	});

	it('flags an empty reference', () => {
		expect(validateTemplate('{{}}', columns).unknown).toEqual(['']);
	});
});

describe('renameInTemplate', () => {
	it('rewrites matching references and leaves others', () => {
		expect(renameInTemplate('{{Customer}} {{Message}}', 'customer', 'Client')).toBe(
			'{{Client}} {{Message}}'
		);
	});
});

describe('autocompleteContext', () => {
	it('detects an open reference before the caret', () => {
		const text = 'Note: {{Cus';
		expect(autocompleteContext(text, text.length)).toEqual({ query: 'Cus', start: 6, end: 11 });
	});

	it('returns null once the reference is closed', () => {
		const text = 'Note: {{Customer}}';
		expect(autocompleteContext(text, text.length)).toBeNull();
	});

	it('returns null across a line break', () => {
		const text = '{{\nCus';
		expect(autocompleteContext(text, text.length)).toBeNull();
	});

	it('works when the caret sits inside empty braces', () => {
		expect(autocompleteContext('a {{}} b', 4)).toEqual({ query: '', start: 2, end: 4 });
	});
});

describe('rankColumns', () => {
	it('puts exact and prefix matches first', () => {
		expect(rankColumns(columns, 'sen').map((column) => column.name)).toEqual(['Sentiment']);
	});

	it('falls back to subsequence matching', () => {
		expect(rankColumns(columns, 'rns').map((column) => column.name)).toEqual(['Raw notes']);
	});

	it('returns everything for an empty query', () => {
		expect(rankColumns(columns, '')).toHaveLength(columns.length);
	});
});

describe('insertReference', () => {
	it('completes a reference that is being typed', () => {
		const result = insertReference('Note: {{Cus', 11, 'Customer');
		expect(result.text).toBe('Note: {{Customer}}');
		expect(result.caret).toBe(18);
	});

	it('replaces the closing braces already in the text', () => {
		const result = insertReference('a {{}} b', 4, 'Message');
		expect(result.text).toBe('a {{Message}} b');
	});

	it('adds a space when dropping a reference after a word', () => {
		expect(insertReference('Summarize', 9, 'Message').text).toBe('Summarize {{Message}}');
	});

	it('does not double the space when one is already there', () => {
		expect(insertReference('Summarize ', 10, 'Message').text).toBe('Summarize {{Message}}');
	});
});
