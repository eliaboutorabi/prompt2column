<script lang="ts">
	import {
		AlertCircleIcon,
		Cancel01Icon,
		Copy01Icon,
		Tick02Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
	}

	let { ws }: Props = $props();

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
	would land on a different row). The name and the text share a first line.
-->
<section class={['reader', cell?.editing && 'editing-now']} aria-label="Cell reader">
	<div class="address">
		{#if cell}
			<strong class="column">{cell.column.name}</strong>
			<span class="row">row {cell.rowIndex + 1}</span>
		{:else}
			<span class="none">No cell selected</span>
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
			<span class="note editing">Editing. Enter saves, Esc cancels</span>
		{:else if cell?.words && !cell.error}
			<span class="note mono">{cell.words} {cell.words === 1 ? 'word' : 'words'}</span>
		{/if}
		<button
			type="button"
			class={['btn btn-ghost action', shownCopyState !== 'idle' && 'wide']}
			disabled={!cell?.value}
			onclick={copy}
			use:tooltip={'Copy the full text'}
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
			use:tooltip={{ text: 'Clear selection', kbd: 'Esc' }}
			aria-label="Clear selection"
			disabled={!cell}
			onclick={() => ws.clearActiveCell()}
		>
			<Icon icon={Cancel01Icon} size={14} strokeWidth={2} />
		</button>
	</div>
</section>

<style>
	/* Two lines of text tall. Every part hangs from the same first line, so the
	   cell's name, its text and the buttons all start level. */
	.reader {
		--lh: 1.25rem;
		display: grid;
		grid-template-columns: minmax(0, 10rem) minmax(0, 1fr) auto;
		align-items: start;
		gap: 1rem;
		padding: 0.7rem 0.6rem 0.7rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		transition: box-shadow var(--dur) ease;
	}

	/* Editing shows as a bar of the accent down the reader's left edge. */
	.reader.editing-now {
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.address {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		height: var(--lh);
		line-height: var(--lh);
		white-space: nowrap;
	}

	.column {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}

	.row {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.none {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-3);
	}

	/* A hairline between the name and the text, as a spreadsheet's formula bar has. */
	.text {
		height: calc(var(--lh) * 2);
		padding-left: 1rem;
		border-left: 1px solid var(--line);
		overflow-y: auto;
		font-size: 0.8125rem;
		line-height: var(--lh);
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

	/* Buttons centred on the first line rather than on the block. */
	.side {
		display: flex;
		align-items: center;
		gap: 0.1rem;
		height: var(--lh);
	}

	.note {
		margin-right: 0.4rem;
		font-size: 0.6875rem;
		color: var(--text-3);
		white-space: nowrap;
	}

	.note.editing {
		color: var(--accent-text);
		font-weight: 500;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.action {
		width: 1.75rem;
		height: 1.75rem;
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
			padding-left: 0.75rem;
		}

		.note {
			display: none;
		}
	}
</style>
