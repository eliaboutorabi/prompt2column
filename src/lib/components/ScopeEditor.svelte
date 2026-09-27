<script lang="ts">
	import {
		ArrowDataTransferVerticalIcon,
		CheckmarkSquare02Icon,
		DashedLineCircleIcon,
		LeftToRightListNumberIcon,
		ListViewIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import Icon from '$lib/components/Icon.svelte';
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

	const options: Array<{ id: ScopeKind; label: string; icon: IconSvgElement }> = [
		{ id: 'all', label: 'Every row', icon: ListViewIcon },
		{ id: 'first', label: 'First few', icon: LeftToRightListNumberIcon },
		{ id: 'range', label: 'A range', icon: ArrowDataTransferVerticalIcon },
		{ id: 'selected', label: 'Ticked rows', icon: CheckmarkSquare02Icon },
		{ id: 'empty', label: 'Empty results', icon: DashedLineCircleIcon }
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
				<Icon icon={option.icon} size={13} />
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

	<p class="touch">
		This run will touch
		<strong>{matchCount}</strong>
		{matchCount === 1 ? 'row' : 'rows'}.
	</p>
</div>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.8rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		padding: 0 0.7rem 0 0.6rem;
		font-size: 0.75rem;
		color: var(--text-2);
		box-shadow: var(--elev-1);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease,
			border-color var(--dur-fast) ease;
	}

	.pill:hover:not(.on):not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	/* Soft, like the presets: the Run button stays the only solid accent in the panel. */
	.pill.on {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent-text);
		font-weight: 500;
	}

	.touch {
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.touch strong {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.pill:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
