<script lang="ts">
	import { CaretDown, CaretUp, CheckSquare, MagnifyingGlass, X } from 'phosphor-svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
		/** Width of the sidebar floating over the right edge, kept clear of controls. */
		occludedRight?: number;
	}

	let { ws, occludedRight = 0 }: Props = $props();

	let input = $state<HTMLInputElement | null>(null);

	const total = $derived(ws.search.matches.length);
	const position = $derived(total ? Math.min(ws.searchIndex, total - 1) + 1 : 0);
	const active = $derived(ws.searchQuery.trim() !== '');
	const shortcut =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
			? '⌘F'
			: 'Ctrl F';

	export function focus() {
		input?.focus();
		input?.select();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			ws.stepSearch(event.shiftKey ? -1 : 1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			if (ws.searchQuery) ws.clearSearch();
			else input?.blur();
		}
	}
</script>

<div class="bar" role="search" style:padding-right="calc(0.6rem + {occludedRight}px)">
	<div class="field-wrap">
		<MagnifyingGlass size={14} class="icon" />
		<input
			bind:this={input}
			type="search"
			class="query"
			placeholder="Find in sheet"
			aria-label="Find in sheet"
			autocomplete="off"
			spellcheck="false"
			value={ws.searchQuery}
			oninput={(event) => ws.setSearch(event.currentTarget.value)}
			onkeydown={onKeydown}
		/>
		{#if active}
			<button
				type="button"
				class="clear"
				aria-label="Clear search"
				onclick={() => {
					ws.clearSearch();
					input?.focus();
				}}
			>
				<X size={12} weight="bold" />
			</button>
		{:else}
			<kbd class="hint">{shortcut}</kbd>
		{/if}
	</div>

	<select
		class="scope"
		aria-label="Column to search"
		value={ws.searchColumnId ?? ''}
		onchange={(event) => ws.setSearchColumn(event.currentTarget.value || null)}
	>
		<option value="">All columns</option>
		{#each ws.columns as column (column.id)}
			<option value={column.id}>{column.name}</option>
		{/each}
	</select>

	{#if active}
		<span class="count" aria-live="polite">
			{#if total}
				<strong>{position}</strong> of {total}
				<span class="rows"
					>{total === 1 ? 'cell' : 'cells'}, {ws.search.rowCount}
					{ws.search.rowCount === 1 ? 'row' : 'rows'}</span
				>
			{:else}
				No matches
			{/if}
		</span>

		<div class="steps">
			<button
				type="button"
				class="btn btn-ghost step"
				aria-label="Previous match"
				title="Previous match (Shift Enter)"
				disabled={!total}
				onclick={() => ws.stepSearch(-1)}
			>
				<CaretUp size={14} weight="bold" />
			</button>
			<button
				type="button"
				class="btn btn-ghost step"
				aria-label="Next match"
				title="Next match (Enter)"
				disabled={!total}
				onclick={() => ws.stepSearch(1)}
			>
				<CaretDown size={14} weight="bold" />
			</button>
		</div>

		{#if total}
			<button
				type="button"
				class="btn btn-ghost tick"
				title="Tick these rows, then run the prompt on ticked rows only"
				disabled={ws.isBusy}
				onclick={() => ws.tickMatchingRows()}
			>
				<CheckSquare size={14} />
				Tick {ws.search.rowCount}
				{ws.search.rowCount === 1 ? 'row' : 'rows'}
			</button>
		{/if}
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.4rem 0.6rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}

	.field-wrap {
		position: relative;
		display: flex;
		align-items: center;
		flex: 0 1 17rem;
		min-width: 10rem;
	}

	.field-wrap :global(.icon) {
		position: absolute;
		left: 0.55rem;
		color: var(--text-3);
		pointer-events: none;
	}

	.query {
		width: 100%;
		height: 1.9rem;
		padding: 0 2.6rem 0 1.85rem;
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		font-size: 0.8125rem;
		transition:
			border-color 0.14s ease,
			background-color 0.14s ease;
	}

	.query::-webkit-search-cancel-button {
		display: none;
	}

	.query:hover {
		border-color: var(--line-strong);
	}

	.query:focus {
		outline: none;
		background: var(--surface);
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.hint {
		position: absolute;
		right: 0.45rem;
		padding: 0 0.3rem;
		border: 1px solid var(--line);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		line-height: 1.1rem;
		color: var(--text-3);
		pointer-events: none;
	}

	.query:focus ~ .hint {
		display: none;
	}

	.clear {
		position: absolute;
		right: 0.35rem;
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 4px;
		color: var(--text-3);
	}

	.clear:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.scope {
		height: 1.9rem;
		max-width: 11rem;
		padding: 0 0.45rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.scope:focus {
		outline: none;
		border-color: var(--accent);
	}

	.count {
		font-size: 0.75rem;
		color: var(--text-2);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.count strong {
		color: var(--text);
		font-weight: 600;
	}

	.rows {
		color: var(--text-3);
		margin-left: 0.25rem;
	}

	.steps {
		display: flex;
	}

	.step {
		padding: 0.3rem;
	}

	.tick {
		margin-left: auto;
		font-size: 0.75rem;
	}
</style>
