/** Light, dark, or follow the system. One theme for the whole app. */
const KEY = 'prompt2column:theme';

export type ThemeChoice = 'light' | 'dark' | 'system';

class ThemeStore {
	choice = $state<ThemeChoice>('system');
	resolved = $state<'light' | 'dark'>('light');
	private media: MediaQueryList | null = null;

	init(): () => void {
		const stored = localStorage.getItem(KEY) as ThemeChoice | null;
		this.choice = stored ?? 'system';
		this.media = window.matchMedia('(prefers-color-scheme: dark)');
		const update = () => this.apply();
		this.media.addEventListener('change', update);
		this.apply();
		return () => this.media?.removeEventListener('change', update);
	}

	set(choice: ThemeChoice): void {
		this.choice = choice;
		localStorage.setItem(KEY, choice);
		this.apply();
	}

	cycle(): void {
		const order: ThemeChoice[] = ['system', 'light', 'dark'];
		this.set(order[(order.indexOf(this.choice) + 1) % order.length]);
	}

	private apply(): void {
		const systemDark = this.media?.matches ?? false;
		this.resolved = this.choice === 'system' ? (systemDark ? 'dark' : 'light') : this.choice;
		document.documentElement.dataset.theme = this.resolved;
	}
}

export const theme = new ThemeStore();
