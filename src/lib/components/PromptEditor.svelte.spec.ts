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
