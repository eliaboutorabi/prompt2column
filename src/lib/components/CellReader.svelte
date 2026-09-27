<script lang="ts">
	import {
		AlertCircleIcon,
		Cancel01Icon,
		Copy01Icon,
		Tick02Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
		/** Width of the sidebar floating over the right edge, kept clear of the text. */
		occludedRight?: number;
	}

	let { ws, occludedRight = 0 }: Props = $props();

	/** Everything about the selected cell, kept live so a run fills it in as you watch. */
	const cell = $derived.by(() => {
		const active = ws.activeCell;
		if (!active) return null;
		const rowIndex = ws.rows.findIndex((row) => row.id === active.rowId);
		const column = ws.columns.find((candidate) => candidate.id === active.columnId);
		if (rowIndex === -1 || !column) return null;
		// While the cell is open for typing, show the draft as it is typed.
		const editing = ws.isEditing(active.rowId, column.id);
		const value = editing ? ws.editDraft : (ws.rows[rowIndex].cells[column.id] ?? '');
		const status =
			column.id === ws.lastRunColumnId ? (ws.cellStatus.get(active.rowId) ?? 'idle') : 'idle';
		const error =
			!editing && status === 'error' ? (ws.cellError.get(active.rowId) ?? 'Failed.') : '';
		const words = value.trim() ? value.trim().split(/\s+/).length : 0;
		return {
			key: `${active.rowId}:${column.id}`,
			rowIndex,
			column,
			value,
			editing,
			status,
			error,
			words
		};
	});

	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let copiedKey = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	// "Copied" belongs to the cell that was copied, so moving on clears it.
	const shownCopyState = $derived(cell && cell.key === copiedKey ? copyState : 'idle');

	async function copy() {
		if (!cell?.value) return;
		const key = cell.key;
		try {
			await navigator.clipboard.writeText(cell.value);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
		copiedKey = key;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copyState = 'idle'), 1600);
	}

	$effect(() => () => clearTimeout(resetTimer));
</script>

<!--
	A formula bar: always on screen at one height, so picking a cell never moves the
	sheet (if it appeared on the first click, the second click of a double-click
	would land on a different row).
-->
<section
	class="reader"
	aria-label="Cell reader"
	style:padding-right="calc(0.75rem + {occludedRight}px)"
>
	<div class={['address', cell?.editing && 'editing-now']}>
		{#if cell}
			<strong class="column">{cell.column.name}</strong>
			<span class="where">
				<span class="row">row {cell.rowIndex + 1}</span>
				{#if cell.editing}
					<span class="editing">Editing</span>
				{/if}
			</span>
		{:else}
			<span class="column none">No cell selected</span>
		{/if}
	</div>

	<!-- Fixed height, scrolls inside. Focusable so a long cell can be scrolled from the keyboard. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="text"
		tabindex="0"
		role="region"
		aria-label={cell ? `${cell.column.name}, row ${cell.rowIndex + 1}` : 'No cell selected'}
	>
		{#if !cell}
			<span class="muted">Click a cell to read all of it here. Double-click to edit it.</span>
		{:else if cell.editing}
			{#if cell.value}{cell.value}{:else}<span class="muted">Empty cell</span>{/if}
		{:else if cell.error}
			<span class="failed"><Icon icon={AlertCircleIcon} size={14} />{cell.error}</span>
		{:else if cell.status === 'running'}
			<span class="muted">Generating</span>
		{:else if cell.status === 'queued' && !cell.value}
			<span class="muted">Waiting to run</span>
		{:else if cell.value}
			{cell.value}
		{:else}
			<span class="muted">Empty cell</span>
		{/if}
	</div>

	<div class="side">
		{#if cell?.editing}
			<span class="note">Enter saves, Esc cancels</span>
		{:else if cell?.words && !cell.error}
			<span class="note mono">{cell.words} {cell.words === 1 ? 'word' : 'words'}</span>
		{/if}
		<button
			type="button"
			class={['btn btn-ghost action', shownCopyState !== 'idle' && 'wide']}
			disabled={!cell?.value}
			onclick={copy}
			title="Copy the full text"
			aria-label={shownCopyState === 'copied' ? 'Copied' : 'Copy cell text'}
		>
			{#if shownCopyState === 'copied'}
				<Icon icon={Tick02Icon} size={15} strokeWidth={2} /> Copied
			{:else if shownCopyState === 'failed'}
				Copy failed
			{:else}
				<Icon icon={Copy01Icon} size={15} />
			{/if}
		</button>
		<button
			type="button"
			class="btn btn-ghost action"
			title="Clear selection"
			aria-label="Clear selection"
			disabled={!cell}
			onclick={() => ws.clearActiveCell()}
		>
			<Icon icon={Cancel01Icon} size={14} strokeWidth={2} />
		</button>
	</div>
</section>

<style>
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.85rem;
		padding: 0.55rem 0.75rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	/* The name box: which cell this is, in a quiet inset like a spreadsheet's. */
	.address {
		display: grid;
		align-content: center;
		gap: 0.1rem;
		height: 2.55rem;
		padding: 0 0.65rem;
		border-radius: var(--radius-control);
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--line);
		min-width: 0;
		transition:
			background-color var(--dur) ease,
			box-shadow var(--dur) ease;
	}

	.address.editing-now {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 1px var(--accent-line);
	}

	.column {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
	}

	.column.none {
		font-weight: 500;
		line-height: 1.25;
		white-space: normal;
		color: var(--text-3);
	}

	.where {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.row {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.editing {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--accent-text);
	}

	.text {
		height: calc(0.8125rem * 1.55 * 2);
		margin-top: 0.3rem;
		overflow-y: auto;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		user-select: text;
	}

	.text:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
		border-radius: 4px;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		height: 2.55rem;
	}

	.note {
		margin-right: 0.4rem;
		font-size: 0.6875rem;
		color: var(--text-3);
		white-space: nowrap;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.action {
		width: 2rem;
		padding: 0;
	}

	.action.wide {
		width: auto;
		padding: 0 0.55rem;
		font-size: 0.75rem;
	}

	.muted {
		color: var(--text-3);
	}

	.failed {
		display: inline-flex;
		align-items: flex-start;
		gap: 0.35rem;
		color: var(--danger);
	}

	.failed :global(.hi) {
		margin-top: 0.15rem;
	}

	@media (max-width: 640px) {
		.reader {
			grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) auto;
			gap: 0.6rem;
		}

		.note {
			display: none;
		}
	}
</style>
