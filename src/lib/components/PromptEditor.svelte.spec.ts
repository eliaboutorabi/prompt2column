import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PromptEditor from './PromptEditor.svelte';
import type { Column } from '$lib/core/types';

const columns: Column[] = [
	{ id: 'c1', name: 'Customer', generated: false },
	{ id: 'c2', name: 'Message', generated: false },
	{ id: 'c3', name: 'Raw notes', generated: false },
	{ id: 'c4', name: 'Sentiment', generated: true }
];

function mount(value = '') {
	return render(PromptEditor, { props: { value, columns } });
}

describe('PromptEditor', () => {
	it('shows the template text in the textarea', async () => {
		mount('Classify {{Customer}}');
		await expect.element(page.getByRole('combobox')).toHaveValue('Classify {{Customer}}');
	});

	it('offers columns after typing an opening reference', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, 'Note: {{{{');
		await expect.element(page.getByRole('option', { name: /Customer/ })).toBeVisible();
		await expect.element(page.getByRole('option', { name: /Raw notes/ })).toBeVisible();
	});

	it('narrows the list as the name is typed', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, '{{{{raw');
		await expect.element(page.getByRole('option', { name: /Raw notes/ })).toBeVisible();
		expect(page.getByRole('option').elements()).toHaveLength(1);
	});

	it('completes the reference when a suggestion is clicked', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, 'Read {{{{mess');
		await userEvent.click(page.getByRole('option', { name: /Message/ }));
		await expect.element(textarea).toHaveValue('Read {{Message}}');
	});

	it('completes the highlighted suggestion on Enter', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, '{{{{cust');
		await userEvent.keyboard('{Enter}');
		await expect.element(textarea).toHaveValue('{{Customer}}');
	});

	it('moves through the list with the arrow keys', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, '{{{{');
		await userEvent.keyboard('{ArrowDown}{Enter}');
		await expect.element(textarea).toHaveValue('{{Message}}');
	});

	it('closes the list on Escape without inserting anything', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		await userEvent.click(textarea);
		await userEvent.type(textarea, '{{{{cust');
		await userEvent.keyboard('{Escape}');
		await expect.element(textarea).toHaveValue('{{cust');
		expect(page.getByRole('option').elements()).toHaveLength(0);
	});

	it('marks a reference that matches no column', async () => {
		const { container } = mount('{{Nope}}');
		await expect.element(page.getByRole('combobox')).toHaveValue('{{Nope}}');
		expect(container.querySelectorAll('.token.unknown')).toHaveLength(1);
	});

	it('keeps a valid reference unmarked', async () => {
		const { container } = mount('{{Customer}}');
		await expect.element(page.getByRole('combobox')).toHaveValue('{{Customer}}');
		expect(container.querySelectorAll('.token.unknown')).toHaveLength(0);
		expect(container.querySelectorAll('.token')).toHaveLength(1);
	});
});

describe('PromptEditor sizing', () => {
	it('has no resize handle', async () => {
		mount();
		const textarea = page.getByRole('combobox').element() as HTMLTextAreaElement;
		expect(getComputedStyle(textarea).resize).toBe('none');
	});

	it('grows as lines are added', async () => {
		mount();
		const textarea = page.getByRole('combobox');
		const element = textarea.element() as HTMLTextAreaElement;
		const start = element.getBoundingClientRect().height;
		await userEvent.click(textarea);
		await userEvent.keyboard(
			'one{Enter}two{Enter}three{Enter}four{Enter}five{Enter}six{Enter}seven'
		);
		await expect.poll(() => element.getBoundingClientRect().height).toBeGreaterThan(start);
		expect(element.scrollHeight).toBeLessThanOrEqual(element.clientHeight + 1);
	});

	it('grows when the prompt is set from outside, as a preset does', async () => {
		const { rerender } = mount('Short');
		const element = page.getByRole('combobox').element() as HTMLTextAreaElement;
		const start = element.getBoundingClientRect().height;
		await rerender({
			value: Array.from({ length: 10 }, (_, i) => `Line ${i}`).join('\n'),
			columns
		});
		await expect.poll(() => element.getBoundingClientRect().height).toBeGreaterThan(start);
	});

	it('stops growing at its maximum and scrolls instead', async () => {
		const long = Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n');
		mount(long);
		const element = page.getByRole('combobox').element() as HTMLTextAreaElement;
		const max = parseFloat(getComputedStyle(element).maxHeight);
		await expect.poll(() => parseFloat(getComputedStyle(element).height)).toBeCloseTo(max, 0);
		expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
		expect(getComputedStyle(element).overflowY).toBe('auto');
	});
});
