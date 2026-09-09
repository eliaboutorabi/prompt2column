<script lang="ts">
	import type { RowScope, ScopeKind } from '$lib/core/types';

	interface Props {
		scope: RowScope;
		overwrite: boolean;
		rowCount: number;
		selectedCount: number;
		matchCount: number;
		hasTarget: boolean;
		disabled?: boolean;
	}

	let {
		scope = $bindable(),
		overwrite = $bindable(),
		rowCount,
		selectedCount,
		matchCount,
		hasTarget,
		disabled = false
	}: Props = $props();

	const options: Array<{ id: ScopeKind; label: string }> = [
		{ id: 'all', label: 'Every row' },
		{ id: 'first', label: 'First few' },
		{ id: 'range', label: 'A range' },
		{ id: 'selected', label: 'Ticked rows' },
		{ id: 'empty', label: 'Empty results' }
	];
</script>

<div class="grid gap-2">
	<span class="label">Rows to run</span>
	<div class="flex flex-wrap gap-1.5">
		{#each options as option (option.id)}
			<button
				type="button"
				class="pill"
				class:on={scope.kind === option.id}
				disabled={disabled || (option.id === 'empty' && !hasTarget)}
				title={option.id === 'empty' && !hasTarget ? 'Available once the column exists' : undefined}
				onclick={() => (scope.kind = option.id)}
			>
				{option.label}
			</button>
		{/each}
	</div>

	{#if scope.kind === 'first'}
		<div class="flex items-center gap-2">
			<input
				type="number"
				min="1"
				max={rowCount}
				class="field w-24"
				bind:value={scope.count}
				{disabled}
				aria-label="How many rows from the top"
			/>
			<span class="text-xs text-ink-3">rows from the top</span>
		</div>
	{:else if scope.kind === 'range'}
		<div class="flex items-center gap-2">
			<input
				type="number"
				min="1"
				max={rowCount}
				class="field w-20"
				bind:value={scope.from}
				{disabled}
				aria-label="First row in the range"
			/>
			<span class="text-xs text-ink-3">to</span>
			<input
				type="number"
				min="1"
				max={rowCount}
				class="field w-20"
				bind:value={scope.to}
				{disabled}
				aria-label="Last row in the range"
			/>
		</div>
	{:else if scope.kind === 'selected'}
		<p class="text-xs text-ink-3">
			{selectedCount === 0
				? 'Tick rows in the sheet to build this set.'
				: `${selectedCount} ticked in the sheet.`}
		</p>
	{/if}

	<label class="flex items-center gap-2 text-xs text-ink-2" class:hidden={scope.kind === 'empty'}>
		<input type="checkbox" class="size-3.5 accent-accent" bind:checked={overwrite} {disabled} />
		Replace values that are already there
	</label>

	<p
		class="rounded-[var(--radius-control)] border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2"
	>
		This run will touch
		<strong class="font-mono text-ink">{matchCount}</strong>
		{matchCount === 1 ? 'row' : 'rows'}.
	</p>
</div>

<style>
	.pill {
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		padding: 0.2rem 0.6rem;
		font-size: 0.75rem;
		color: var(--text-2);
		transition:
			background-color 0.14s ease,
			color 0.14s ease,
			border-color 0.14s ease;
	}

	.pill:hover:not(.on):not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.pill.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
		font-weight: 500;
	}

	.pill:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
