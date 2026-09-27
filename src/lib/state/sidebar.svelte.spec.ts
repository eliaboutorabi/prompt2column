import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import {
	clampSidebar,
	sidebar,
	sidebarMax,
	SIDEBAR_DEFAULT,
	SIDEBAR_MAX,
	SIDEBAR_MIN
} from './sidebar.svelte';

const KEY = 'prompt2column:sidebar-width';

// A desktop window, where the sidebar has room to grow.
beforeAll(async () => {
	await page.viewport(1440, 900);
});

afterEach(() => {
	localStorage.removeItem(KEY);
	sidebar.width = SIDEBAR_DEFAULT;
});

describe('sidebar width', () => {
	it('stays between its limits', () => {
		expect(clampSidebar(100, 1600)).toBe(SIDEBAR_MIN);
		expect(clampSidebar(5000, 1600)).toBe(SIDEBAR_MAX);
		expect(clampSidebar(500.4, 1600)).toBe(500);
	});

	it('always leaves the sheet room beside it', () => {
		expect(sidebarMax(1000)).toBe(640);
		expect(clampSidebar(700, 1000)).toBe(640);
		// Never narrower than its minimum, however small the window.
		expect(sidebarMax(500)).toBe(SIDEBAR_MIN);
	});

	it('remembers the chosen width on this computer', () => {
		sidebar.set(520);
		sidebar.save();
		sidebar.width = SIDEBAR_DEFAULT;
		sidebar.load();
		expect(sidebar.width).toBe(520);
	});

	it('ignores a stored width that makes no sense', () => {
		localStorage.setItem(KEY, 'wide');
		sidebar.load();
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT);
		localStorage.setItem(KEY, '99999');
		sidebar.load();
		expect(sidebar.width).toBe(SIDEBAR_MAX);
	});

	it('goes back to the default on reset, and remembers that too', () => {
		sidebar.set(600);
		sidebar.reset();
		expect(sidebar.width).toBe(SIDEBAR_DEFAULT);
		expect(localStorage.getItem(KEY)).toBe(String(SIDEBAR_DEFAULT));
	});
});
