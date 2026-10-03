<script lang="ts">
	import {
		ArrowDataTransferVerticalIcon,
		CheckmarkSquare02Icon,
		DashedLineCircleIcon,
		LeftToRightListNumberIcon,
		ListViewIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import NumberField from './NumberField.svelte';
	import Select from './Select.svelte';
	import type { RowScope, ScopeKind } from '$lib/core/types';

	interface Props {
		scope: RowScope;
		overwrite: boolean;
		rowCount: number;
		selectedCount: number;
		hasTarget: boolean;
		disabled?: boolean;
		/** Id for the list, so a <label for> outside can name it. */
		id?: string;
	}

	let {
		scope = $bindable(),
		overwrite = $bindable(),
		rowCount,
		selectedCount,
		hasTarget,
		disabled = false,
		id = 'scope'
	}: Props = $props();

	const kinds: Array<{ id: ScopeKind; label: string; icon: IconSvgElement }> = [
		{ id: 'all', label: 'Every row', icon: ListViewIcon },
		{ id: 'first', label: 'First few', icon: LeftToRightListNumberIcon },
		{ id: 'range', label: 'A range', icon: ArrowDataTransferVerticalIcon },
		{ id: 'selected', label: 'Ticked rows', icon: CheckmarkSquare02Icon },
		{ id: 'empty', label: 'Empty results', icon: DashedLineCircleIcon }
	];

	const options = $derived(
		kinds.map((kind) => ({
			value: kind.id,
			label: kind.label,
			icon: kind.icon,
			disabled: kind.id === 'empty' && !hasTarget,
			reason: 'Available once the column exists'
		}))
	);

	// The saved counts don't know the sheet's size; fit them to it when picked.
	function pick(kind: ScopeKind) {
		scope.kind = kind;
		if (kind === 'first') scope.count = Math.max(1, Math.min(scope.count, rowCount));
		if (kind === 'range') {
			scope.to = Math.max(1, Math.min(scope.to, rowCount));
			scope.from = Math.max(1, Math.min(scope.from, scope.to));
		}
	}
</script>

<div class="scope">
	<div class="line">
		<span class="kind">
			<Select
				{id}
				block
				{options}
				value={scope.kind}
				{disabled}
				onchange={(value) => pick(value as ScopeKind)}
			/>
		</span>

		{#if scope.kind === 'first'}
			<span class="number">
				<NumberField
					min={1}
					max={rowCount}
					bind:value={scope.count}
					{disabled}
					label="How many rows from the top"
				/>
			</span>
			<span class="note">from the top</span>
		{:else if scope.kind === 'range'}
			<span class="number">
				<NumberField
					min={1}
					max={rowCount}
					bind:value={scope.from}
					{disabled}
					label="First row in the range"
				/>
			</span>
			<span class="note">to</span>
			<span class="number">
				<NumberField
					min={1}
					max={rowCount}
					bind:value={scope.to}
					{disabled}
					label="Last row in the range"
				/>
			</span>
		{:else if scope.kind === 'selected'}
			<span class="note">
				{selectedCount === 0 ? 'Tick rows in the sheet' : `${selectedCount} ticked in the sheet`}
			</span>
		{/if}
	</div>

	{#if scope.kind !== 'empty'}
		<label class="toggle">
			Replace values that are already there
			<input type="checkbox" role="switch" bind:checked={overwrite} {disabled} />
		</label>
	{/if}
</div>

<style>
	.scope {
		display: grid;
		gap: 0.75rem;
	}

	.line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.kind {
		display: flex;
		flex: 1 1 9rem;
		min-width: 0;
	}

	.number {
		flex: 0 0 4.75rem;
	}

	.note {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--text-3);
		white-space: nowrap;
	}
</style>
