<script lang="ts">
	import { Check, Copy, WarningCircle, X } from 'phosphor-svelte';
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
		const value = ws.rows[rowIndex].cells[column.id] ?? '';
		const status =
			column.id === ws.lastRunColumnId ? (ws.cellStatus.get(active.rowId) ?? 'idle') : 'idle';
		const error = status === 'error' ? (ws.cellError.get(active.rowId) ?? 'Failed.') : '';
		const words = value.trim() ? value.trim().split(/\s+/).length : 0;
		return { key: `${active.rowId}:${column.id}`, rowIndex, column, value, status, error, words };
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

<!-- Always present so the sheet's grid rows stay put; empty until a cell is picked. -->
<div class="slot">
	{#if cell}
		<section
			class="reader"
			aria-label="Cell reader"
			style:padding-right="calc(0.75rem + {occludedRight}px)"
		>
			<div class="meta">
				<span class="where">
					<strong>{cell.column.name}</strong>
					<span class="row">row {cell.rowIndex + 1}</span>
					{#if cell.words && !cell.error}
						<span class="words">{cell.words} {cell.words === 1 ? 'word' : 'words'}</span>
					{/if}
				</span>
				<button
					type="button"
					class="btn btn-ghost action"
					disabled={!cell.value}
					onclick={copy}
					aria-label={shownCopyState === 'copied' ? 'Copied' : 'Copy cell text'}
				>
					{#if shownCopyState === 'copied'}
						<Check size={13} weight="bold" /> Copied
					{:else if shownCopyState === 'failed'}
						Copy failed
					{:else}
						<Copy size={13} /> Copy
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-ghost action close"
					aria-label="Close cell reader"
					onclick={() => ws.clearActiveCell()}
				>
					<X size={13} weight="bold" />
				</button>
			</div>

			<!-- Fixed height, scrolls inside: stepping through cells never shifts the grid.
			     Focusable so a long cell can be scrolled from the keyboard. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="text"
				class:mono={cell.column.generated}
				tabindex="0"
				role="region"
				aria-label={`${cell.column.name}, row ${cell.rowIndex + 1}`}
			>
				{#if cell.error}
					<span class="failed"><WarningCircle size={14} weight="fill" />{cell.error}</span>
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
		</section>
	{/if}
</div>

<style>
	.reader {
		display: grid;
		gap: 0.3rem;
		padding: 0.5rem 0.75rem 0.6rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	.where {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
		font-size: 0.75rem;
		color: var(--text-3);
		white-space: nowrap;
	}

	.where strong {
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 600;
		color: var(--text-2);
	}

	.row,
	.words {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
	}

	.action {
		padding: 0.2rem 0.45rem;
		font-size: 0.75rem;
	}

	.close {
		padding: 0.2rem 0.3rem;
	}

	.text {
		height: calc(0.8125rem * 1.55 * 3);
		overflow-y: auto;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		user-select: text;
	}

	.text.mono {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.text:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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

	.failed :global(svg) {
		flex-shrink: 0;
		margin-top: 0.15rem;
	}
</style>
