/** One short confirmation at a time, for actions whose result isn't otherwise visible. */
export type ToastTone = 'success' | 'info';

class ToastStore {
	current = $state<{ id: number; message: string; tone: ToastTone } | null>(null);
	private timer: ReturnType<typeof setTimeout> | undefined;
	private next = 0;

	show(message: string, tone: ToastTone = 'success', ms = 2800): void {
		clearTimeout(this.timer);
		this.next += 1;
		this.current = { id: this.next, message, tone };
		this.timer = setTimeout(() => this.dismiss(), ms);
	}

	dismiss(): void {
		clearTimeout(this.timer);
		this.current = null;
	}
}

export const toast = new ToastStore();
