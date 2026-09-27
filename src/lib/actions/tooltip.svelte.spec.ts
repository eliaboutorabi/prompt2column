import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { tooltip } from './tooltip';

const sources = import.meta.glob('/src/**/*.svelte', {
	query: '?raw',
	import: 'default',
	eager: true
});
import '../../routes/layout.css';

const cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function button(name: string, param: Parameters<typeof tooltip>[1]) {
	const element = document.createElement('button');
	element.setAttribute('aria-label', name);
	element.textContent = '×';
	element.style.cssText = 'margin: 120px; width: 32px; height: 32px;';
	document.body.append(element);
	const action = tooltip(element, param);
	cleanups.push(() => {
		action?.destroy?.();
		element.remove();
	});
	return { element, action };
}

const tip = () => page.getByRole('tooltip');

describe('tooltip', () => {
	it('shows its text in the app style on hover, then goes on leave', async () => {
		const { element } = button('Clear search', { text: 'Clear search', kbd: 'Esc' });
		await userEvent.hover(element);
		await expect.element(tip()).toBeVisible();
		await expect.element(tip()).toHaveTextContent('Clear searchEsc');
		expect(getComputedStyle(tip().element()).position).toBe('fixed');
		await userEvent.unhover(element);
		await expect.poll(() => document.querySelector('.tooltip:popover-open')).toBeNull();
	});

	it('sits centred above its target', async () => {
		const { element } = button('Next', 'Next match');
		await userEvent.hover(element);
		await expect.element(tip()).toBeVisible();
		const target = element.getBoundingClientRect();
		const box = tip().element().getBoundingClientRect();
		expect(box.bottom).toBeLessThanOrEqual(target.top);
		expect(Math.abs(box.left + box.width / 2 - (target.left + target.width / 2))).toBeLessThan(2);
	});

	it('describes the target only when it says more than the name', async () => {
		const same = button('Clear search', 'Clear search');
		await userEvent.hover(same.element);
		await expect.element(tip()).toBeVisible();
		expect(same.element.hasAttribute('aria-describedby')).toBe(false);

		const more = button('Tick 2 rows', 'Tick the 2 rows with a match');
		await userEvent.hover(more.element);
		await expect.element(tip()).toHaveTextContent('Tick the 2 rows with a match');
		expect(more.element.getAttribute('aria-describedby')).toBe(tip().element().id);
	});

	it('hides as soon as the target is pressed', async () => {
		const { element } = button('Next', 'Next match');
		await userEvent.hover(element);
		await expect.element(tip()).toBeVisible();
		element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await expect.poll(() => document.querySelector('.tooltip:popover-open')).toBeNull();
	});

	it('follows a change of text while showing', async () => {
		const { element, action } = button('Status', 'Ollama at localhost:11434');
		await userEvent.hover(element);
		await expect.element(tip()).toHaveTextContent('localhost');
		action?.update?.('Ollama is not answering');
		await expect.element(tip()).toHaveTextContent('Ollama is not answering');
	});

	it('is the only tooltip: no component falls back to the browser title bubble', () => {
		const offenders = Object.entries(sources)
			.filter(([, source]) =>
				/(^|\s)title=/m.test(String(source).replace(/<title>[\s\S]*?<\/title>/g, ''))
			)
			.map(([path]) => path);
		expect(offenders).toEqual([]);
	});
});
