import { innerWidth } from 'svelte/reactivity/window';

/** How wide the composer sidebar is, remembered on this computer like the theme. */
const KEY = 'prompt2column:sidebar-width';

export const SIDEBAR_DEFAULT = 384;
export const SIDEBAR_MIN = 320;
export const SIDEBAR_MAX = 720;
/** Room always left for the sheet beside the sidebar. */
export const SHEET_MIN = 360;

/** The widest the sidebar may be in a window this wide. */
export function sidebarMax(viewport: number): number {
	return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, viewport - SHEET_MIN));
}

export function clampSidebar(width: number, viewport: number): number {
	return Math.round(Math.min(sidebarMax(viewport), Math.max(SIDEBAR_MIN, width)));
}

class SidebarStore {
	/** What the user chose. A narrow window can show less without forgetting it. */
	width = $state(SIDEBAR_DEFAULT);

	get viewport(): number {
		return innerWidth.current ?? SIDEBAR_DEFAULT + SHEET_MIN;
	}

	get max(): number {
		return sidebarMax(this.viewport);
	}

	/** The width actually drawn in the current window. */
	get shown(): number {
		return clampSidebar(this.width, this.viewport);
	}

	load(): void {
		try {
			const stored = Number(localStorage.getItem(KEY));
			if (Number.isFinite(stored) && stored > 0) this.width = clampSidebar(stored, SIDEBAR_MAX * 4);
		} catch {
			// Storage can be blocked; the default width is fine.
		}
	}

	set(width: number): void {
		this.width = clampSidebar(width, this.viewport);
	}

	save(): void {
		try {
			localStorage.setItem(KEY, String(this.width));
		} catch {
			// Not remembered this time; nothing else depends on it.
		}
	}

	reset(): void {
		this.width = SIDEBAR_DEFAULT;
		this.save();
	}
}

export const sidebar = new SidebarStore();
