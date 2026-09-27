<script lang="ts" generics="T extends number | null">
	import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		/** A number, or null for "no value" when the field is optional. */
		value: T;
		min?: number;
		max?: number;
		step?: number;
		/** Allow the field to be emptied, which sets the value to null. */
		optional?: boolean;
		placeholder?: string;
		id?: string;
		/** Accessible name when there is no <label for> pointing at it. */
		label?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		min,
		max,
		step = 1,
		optional = false,
		placeholder,
		id,
		label,
		disabled = false,
		class: className = ''
	}: Props = $props();

	let input = $state<HTMLInputElement | null>(null);
	const decimals = $derived((String(step).split('.')[1] ?? '').length);

	function clamp(next: number): number {
		let result = next;
		if (min !== undefined) result = Math.max(min, result);
		if (max !== undefined) result = Math.min(max, result);
		return Number(result.toFixed(decimals));
	}

	function set(next: number | null) {
		value = next as T;
	}

	function nudge(direction: 1 | -1) {
		if (disabled) return;
		const current = value ?? (direction > 0 ? (min ?? 0) - step : (max ?? min ?? 0) + step);
		set(clamp(current + direction * step));
	}

	// While typing, only a parseable number updates the value; blurring tidies up.
	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		const raw = event.currentTarget.value;
		if (raw === '') {
			if (optional) set(null);
			return;
		}
		const parsed = Number(raw);
		if (Number.isFinite(parsed)) set(parsed);
	}

	function onBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		if (event.currentTarget.value === '' && optional) return;
		const next = value === null ? clamp(min ?? 0) : clamp(value);
		set(next);
		event.currentTarget.value = String(next);
	}

	/** Press and hold a step button to keep stepping, slowly at first. */
	let repeat: ReturnType<typeof setTimeout> | undefined;
	function hold(direction: 1 | -1, event: PointerEvent) {
		if (event.button !== 0 || disabled) return;
		event.preventDefault();
		input?.focus();
		nudge(direction);
		const again = (delay: number) => {
			repeat = setTimeout(() => {
				nudge(direction);
				again(Math.max(40, delay * 0.8));
			}, delay);
		};
		again(380);
	}

	function release() {
		clearTimeout(repeat);
	}

	const atMin = $derived(min !== undefined && value !== null && value <= min);
	const atMax = $derived(max !== undefined && value !== null && value >= max);
</script>

<svelte:window onpointerup={release} onblur={release} />

<span class={['number', disabled && 'disabled', className]}>
	<input
		bind:this={input}
		type="number"
		inputmode={decimals ? 'decimal' : 'numeric'}
		{id}
		aria-label={label}
		{min}
		{max}
		{step}
		{placeholder}
		{disabled}
		value={value ?? ''}
		oninput={onInput}
		onblur={onBlur}
	/>
	<!-- Arrow keys step the field itself, so these are for the pointer only. -->
	<span class="steps" aria-hidden="true">
		<button
			type="button"
			tabindex="-1"
			disabled={disabled || atMax}
			onpointerdown={(event) => hold(1, event)}
			onpointerleave={release}
		>
			<Icon icon={ArrowUp01Icon} size={11} strokeWidth={2.2} />
		</button>
		<button
			type="button"
			tabindex="-1"
			disabled={disabled || atMin}
			onpointerdown={(event) => hold(-1, event)}
			onpointerleave={release}
		>
			<Icon icon={ArrowDown01Icon} size={11} strokeWidth={2.2} />
		</button>
	</span>
</span>

<style>
	.number {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		width: 100%;
		height: 2.25rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		background: var(--surface);
		box-shadow: var(--elev-1);
		transition:
			border-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease;
	}

	.number:hover:not(.disabled) {
		border-color: color-mix(in oklch, var(--text-3) 70%, var(--line-strong));
	}

	.number:focus-within {
		border-color: var(--accent);
		box-shadow: var(--ring);
	}

	.disabled {
		opacity: 0.55;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0 0 0 0.7rem;
		border: 0;
		background: transparent;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		appearance: textfield;
		-moz-appearance: textfield;
	}

	input:focus {
		outline: none;
	}

	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}

	.steps {
		display: grid;
		grid-template-rows: 1fr 1fr;
		width: 1.35rem;
		margin: 3px 3px 3px 0;
		border-radius: 5px;
		overflow: hidden;
		opacity: 0.7;
		transition: opacity var(--dur-fast) ease;
	}

	.number:hover .steps,
	.number:focus-within .steps {
		opacity: 1;
	}

	.steps button {
		display: grid;
		place-items: center;
		color: var(--text-3);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.steps button:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--text);
	}

	.steps button:active:not(:disabled) {
		background: color-mix(in oklch, var(--accent) 30%, var(--surface-3));
	}

	.steps button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
