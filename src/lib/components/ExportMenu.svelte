<script lang="ts">
	import { tick } from 'svelte';
	import { BracketsCurly, CaretDown, DownloadSimple, FileCsv } from 'phosphor-svelte';
	import type { ExportFormat } from '$lib/core/export';

	interface Props {
		disabled?: boolean;
		onExport: (format: ExportFormat) => void;
	}

	let { disabled = false, onExport }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);

	const formats: Array<{ id: ExportFormat; label: string; hint: string }> = [
		{ id: 'csv', label: 'CSV', hint: 'Opens in Excel, Sheets or Numbers' },
		{ id: 'json', label: 'JSON', hint: 'One object per row, for code' }
	];

	function items(): HTMLButtonElement[] {
		return [...(root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
	}

	async function show() {
		open = true;
		await tick();
		items()[0]?.focus();
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function choose(format: ExportFormat) {
		hide();
		onExport(format);
	}

	function onMenuKeydown(event: KeyboardEvent) {
		const list = items();
		const index = list.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			list[(index + step + list.length) % list.length]?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			list[event.key === 'Home' ? 0 : list.length - 1]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			hide();
		} else if (event.key === 'Tab') {
			hide(false);
		}
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (open && root && !root.contains(event.target as Node)) hide(false);
	}}
/>

<div class="wrap" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="btn btn-outline"
		aria-haspopup="menu"
		aria-expanded={open}
		{disabled}
		onclick={() => (open ? hide() : show())}
		onkeydown={(event) => {
			if (event.key === 'ArrowDown' && !open) {
				event.preventDefault();
				void show();
			}
		}}
	>
		<DownloadSimple size={15} /> Export
		<CaretDown size={11} weight="bold" class="caret" />
	</button>

	{#if open}
		<div
			class="menu"
			role="menu"
			aria-label="Export format"
			tabindex="-1"
			onkeydown={onMenuKeydown}
		>
			{#each formats as format (format.id)}
				<button type="button" role="menuitem" class="item" onclick={() => choose(format.id)}>
					{#if format.id === 'csv'}
						<FileCsv size={17} class="icon" />
					{:else}
						<BracketsCurly size={17} class="icon" />
					{/if}
					<span class="text">
						<span class="label">{format.label}</span>
						<span class="hint">{format.hint}</span>
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}

	.wrap :global(.caret) {
		margin-left: -0.1rem;
		color: var(--text-3);
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		z-index: 40;
		display: grid;
		min-width: 15.5rem;
		padding: 0.25rem;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pop);
	}

	.item {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.45rem 0.55rem;
		border-radius: 6px;
		text-align: left;
		color: var(--text);
	}

	.item:hover,
	.item:focus-visible {
		background: var(--surface-2);
		outline: none;
	}

	.item :global(.icon) {
		flex-shrink: 0;
		margin-top: 0.05rem;
		color: var(--text-3);
	}

	.item:hover :global(.icon),
	.item:focus-visible :global(.icon) {
		color: var(--accent-text);
	}

	.text {
		display: grid;
		gap: 0.05rem;
	}

	.label {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-3);
	}
</style>
