<script lang="ts">
	import {
		ArrowDown01Icon,
		ArrowUp01Icon,
		Cancel01Icon,
		CheckmarkSquare02Icon,
		FilterHorizontalIcon,
		Search01Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import Select from './Select.svelte';
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
		<Icon icon={Search01Icon} size={14} class="icon" />
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
				<Icon icon={Cancel01Icon} size={12} strokeWidth={2} />
			</button>
		{:else}
			<kbd class="hint">{shortcut}</kbd>
		{/if}
	</div>

	<span class="scope">
		<Select
			compact
			block
			icon={FilterHorizontalIcon}
			aria-label="Column to search"
			value={ws.searchColumnId ?? ''}
			onchange={(event) => ws.setSearchColumn(event.currentTarget.value || null)}
		>
			<option value="">All columns</option>
			{#each ws.columns as column (column.id)}
				<option value={column.id}>{column.name}</option>
			{/each}
		</Select>
	</span>

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
				<Icon icon={ArrowUp01Icon} size={14} strokeWidth={2} />
			</button>
			<button
				type="button"
				class="btn btn-ghost step"
				aria-label="Next match"
				title="Next match (Enter)"
				disabled={!total}
				onclick={() => ws.stepSearch(1)}
			>
				<Icon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
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
				<Icon icon={CheckmarkSquare02Icon} size={14} />
				Tick {ws.search.rowCount}
				{ws.search.rowCount === 1 ? 'row' : 'rows'}
			</button>
		{/if}
	{/if}

	{#if ws.selected.size}
		<span class="ticked" role="status">
			<Icon icon={CheckmarkSquare02Icon} size={13} />
			<b>{ws.selected.size}</b>
			ticked
			<button
				type="button"
				class="untick"
				title="Untick every row"
				aria-label="Untick every row"
				disabled={ws.isBusy}
				onclick={() => ws.selectAll(false)}
			>
				<Icon icon={Cancel01Icon} size={11} strokeWidth={2.2} />
			</button>
		</span>
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
		flex: 0 1 11rem;
		min-width: 7.5rem;
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
		height: 1.9rem;
		font-size: 0.75rem;
	}

	/* How many rows a "Ticked rows" run would take, with a quick way out. */
	.ticked {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		height: 1.6rem;
		margin-left: auto;
		padding: 0 0.25rem 0 0.55rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-text);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.ticked b {
		font-family: var(--font-mono);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.untick {
		display: grid;
		place-items: center;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 999px;
		color: inherit;
		transition: background-color var(--dur-fast) ease;
	}

	.untick:hover:not(:disabled) {
		background: color-mix(in oklch, var(--accent) 30%, transparent);
	}
</style>
