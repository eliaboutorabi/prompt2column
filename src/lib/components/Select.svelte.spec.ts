import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';
import '../../routes/layout.css';

const options = [
	{ value: 'gemma', label: 'gemma4:e2b-mlx', hint: '7.0 GB', badges: ['thinking'] },
	{ value: 'qwen', label: 'qwen3:8b', hint: '4.8 GB' },
	{ value: 'llama', label: 'llama3.2', hint: '2.0 GB' }
];

function mount(extra: Record<string, unknown> = {}) {
	const onchange = vi.fn();
	const result = render(Select, {
		props: { options, value: 'qwen', label: 'Model', onchange, ...extra }
	});
	return { ...result, onchange };
}

const combobox = () => page.getByRole('combobox', { name: 'Model' });
const listbox = () => page.getByRole('listbox');

describe('Select', () => {
	it('shows the chosen option, with its hint, and no native select', async () => {
		const { container } = mount();
		await expect.element(combobox()).toHaveTextContent('qwen3:8b');
		await expect.element(combobox()).toHaveTextContent('4.8 GB');
		expect(container.querySelector('select')).toBeNull();
	});

	it('opens a styled list on click, marking the chosen option', async () => {
		mount();
		await userEvent.click(combobox());
		await expect.element(listbox()).toBeVisible();
		await expect.element(combobox()).toHaveAttribute('aria-expanded', 'true');
		await expect
			.element(page.getByRole('option', { name: /qwen3:8b/ }))
			.toHaveAttribute('aria-selected', 'true');
		await expect
			.element(page.getByRole('option', { name: /gemma4/ }))
			.toHaveTextContent('thinking');
	});

	it('picks an option with the mouse and reports it', async () => {
		const { onchange } = mount();
		await userEvent.click(combobox());
		await userEvent.click(page.getByRole('option', { name: /llama3\.2/ }));
		expect(onchange).toHaveBeenCalledWith('llama');
		await expect.element(combobox()).toHaveTextContent('llama3.2');
		await expect.element(combobox()).toHaveAttribute('aria-expanded', 'false');
	});

	it('works from the keyboard: arrows move, Enter picks, focus stays put', async () => {
		const { onchange } = mount();
		combobox().element().focus();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(listbox()).toBeVisible();
		await userEvent.keyboard('{ArrowDown}{Enter}');
		expect(onchange).toHaveBeenCalledWith('llama');
		expect(document.activeElement).toBe(combobox().element());
	});

	it('points assistive tech at the highlighted option while open', async () => {
		mount();
		combobox().element().focus();
		await userEvent.keyboard('{ArrowDown}');
		const active = combobox().element().getAttribute('aria-activedescendant');
		expect(active).toBeTruthy();
		expect(document.getElementById(active!)?.textContent).toContain('qwen3:8b');
	});

	it('closes on Escape without changing anything', async () => {
		const { onchange } = mount();
		await userEvent.click(combobox());
		await userEvent.keyboard('{Escape}');
		await expect.element(combobox()).toHaveAttribute('aria-expanded', 'false');
		expect(onchange).not.toHaveBeenCalled();
	});

	it('jumps to an option by typing its first letters', async () => {
		const { onchange } = mount();
		combobox().element().focus();
		await userEvent.keyboard('l');
		expect(onchange).toHaveBeenCalledWith('llama');
	});

	it('shows a placeholder when nothing matches the value', async () => {
		mount({ value: '', placeholder: 'No models found' });
		await expect.element(combobox()).toHaveTextContent('No models found');
	});

	it('does nothing while disabled', async () => {
		mount({ disabled: true });
		await expect.element(combobox()).toBeDisabled();
	});

	it('draws one box around the trigger, not two', async () => {
		mount();
		const wrapper = combobox().element().parentElement!;
		expect(getComputedStyle(wrapper).borderTopWidth).toBe('0px');
		expect(getComputedStyle(combobox().element()).borderTopWidth).toBe('1px');
	});

	it('keeps the chevron clear of the edge', async () => {
		mount();
		const trigger = combobox().element();
		const chevron = trigger.querySelector('.chevron')!;
		const gap = trigger.getBoundingClientRect().right - chevron.getBoundingClientRect().right;
		expect(gap).toBeGreaterThanOrEqual(8);
	});
});
