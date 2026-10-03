import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SidebarResizer from './SidebarResizer.svelte';
import { sidebar, SIDEBAR_DEFAULT, SIDEBAR_MIN } from '$lib/state/sidebar.svelte';

const KEY = 'prompt2column:sidebar-width';

// A desktop window, where the sidebar has room to grow.
beforeAll(async () => {
	await page.viewport(1440, 900);
});

afterEach(() => {
	for (const pane of panes.splice(0)) pane.remove();
	localStorage.removeItem(KEY);
	sidebar.width = SIDEBAR_DEFAULT;
});

/** Inside a positioned pane, as in the app, so the handle straddles its right edge on screen. */
function mount() {
	const pane = document.createElement('div');
	pane.style.cssText = 'position: relative; margin-left: 600px; width: 384px; height: 400px;';
	document.body.append(pane);
	panes.push(pane);
	return render(SidebarResizer, { target: pane });
}

const panes: HTMLElement[] = [];

const handle = () => page.getByRole('separator', { name: 'Resize sidebar' });

function drag(from: number, to: number) {
	const element = handle().element();
	element.dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: from })
	);
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: (from + to) / 2 }));
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: to }));
	window.dispatchEvent(new PointerEvent('pointerup', { clientX: to }));
}

describe('SidebarResizer', () => {
	it('is a focusable splitter that reports the width', async () => {
		mount();
		await expect.element(handle()).toHaveAttribute('aria-orientation', 'vertical');
		await expect.element(handle()).toHaveAttribute('aria-valuenow', String(SIDEBAR_DEFAULT));
		await expect.element(handle()).toHaveAttribute('aria-valuemin', String(SIDEBAR_MIN));
		await expect.element(handle()).toHaveAttribute('tabindex', '0');
	});

	it('widens the sidebar when its edge is dragged right, and remembers it', async () => {
		mount();
		drag(600, 700);
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT + 100);
		expect(localStorage.getItem(KEY)).toBe(String(SIDEBAR_DEFAULT + 100));
		await expect.element(handle()).toHaveAttribute('aria-valuenow', String(SIDEBAR_DEFAULT + 100));
	});

	it('narrows it when dragged left, down to its minimum', async () => {
		mount();
		drag(600, 0);
		expect(sidebar.width).toBe(SIDEBAR_MIN);
	});

	it('stops following the pointer once released', async () => {
		mount();
		drag(600, 640);
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1400 }));
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT + 40);
	});

	it('holds the resize cursor across the page only while dragging', async () => {
		mount();
		handle()
			.element()
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 600 }));
		await expect
			.poll(() => document.documentElement.classList.contains('resizing-sidebar'))
			.toBe(true);
		window.dispatchEvent(new PointerEvent('pointerup'));
		await expect
			.poll(() => document.documentElement.classList.contains('resizing-sidebar'))
			.toBe(false);
	});

	it('resizes from the keyboard, in bigger steps with Shift', async () => {
		mount();
		handle().element().focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT + 16);
		await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT + 16 - 64);
		await userEvent.keyboard('{Home}');
		expect(sidebar.width).toBe(SIDEBAR_MIN);
		await userEvent.keyboard('{End}');
		expect(sidebar.width).toBe(sidebar.max);
	});

	it('goes back to the default width on double-click', async () => {
		mount();
		drag(600, 750);
		await userEvent.dblClick(handle());
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT);
	});
});
