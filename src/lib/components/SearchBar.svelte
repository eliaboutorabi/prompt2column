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
	import { tooltip } from '$lib/actions/tooltip';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
	}

	let { ws }: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let focused = $state(false);

	const total = $derived(ws.search.matches.length);
	const position = $derived(total ? Math.min(ws.searchIndex, total - 1) + 1 : 0);
	const active = $derived(ws.searchQuery.trim() !== '');
	const rows = $derived(ws.search.rowCount);
	const rowWord = $derived(rows === 1 ? 'row' : 'rows');
	// Quiet until used: the extra controls only appear once there's something to act on.
	const open = $derived(focused || active || ws.searchColumnId !== null);
	const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
	const shortcut = mac ? '⌘F' : 'Ctrl F';

	const scopeOptions = $derived([
		{ value: '', label: 'All columns' },
		...ws.columns.map((column) => ({ value: column.id, label: column.name }))
	]);

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

	// Focus moving between the field's own controls (or into the column list) keeps it open.
	function onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (!next || !root?.contains(next)) focused = false;
	}
</script>

<div
	bind:this={root}
	class={['search', open && 'open', active && 'active']}
	role="search"
	onfocusin={() => (focused = true)}
	onfocusout={onFocusOut}
>
	<Icon icon={Search01Icon} size={14} class="glass" />
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
		<span class="count" aria-live="polite">
			{#if total}
				<b>{position}</b> of {total}
			{:else}
				No matches
			{/if}
		</span>
		<button
			type="button"
			class="mini"
			aria-label="Previous match"
			disabled={!total}
			use:tooltip={{ text: 'Previous match', kbd: '⇧↵' }}
			onclick={() => ws.stepSearch(-1)}
		>
			<Icon icon={ArrowUp01Icon} size={13} strokeWidth={2} />
		</button>
		<button
			type="button"
			class="mini"
			aria-label="Next match"
			disabled={!total}
			use:tooltip={{ text: 'Next match', kbd: '↵' }}
			onclick={() => ws.stepSearch(1)}
		>
			<Icon icon={ArrowDown01Icon} size={13} strokeWidth={2} />
		</button>
	{:else if !open}
		<kbd class="hint">{shortcut}</kbd>
	{/if}

	{#if open}
		<span class="divider" aria-hidden="true"></span>
		<span class="scope">
			<Select
				variant="ghost"
				compact
				icon={FilterHorizontalIcon}
				label="Column to search"
				options={scopeOptions}
				value={ws.searchColumnId ?? ''}
				onchange={(value) => ws.setSearchColumn(value || null)}
			/>
		</span>
	{/if}

	{#if active && total}
		<button
			type="button"
			class="mini tick"
			aria-label="Tick {rows} {rowWord}"
			disabled={ws.isBusy}
			use:tooltip={`Tick the ${rows} ${rowWord} with a match, to run the prompt on just ${rows === 1 ? 'it' : 'them'}`}
			onclick={() => ws.tickMatchingRows()}
		>
			<Icon icon={CheckmarkSquare02Icon} size={14} />
		</button>
	{/if}

	{#if active}
		<button
			type="button"
			class="mini"
			aria-label="Clear search"
			use:tooltip={{ text: 'Clear search', kbd: 'Esc' }}
			onclick={() => {
				ws.clearSearch();
				input?.focus();
			}}
		>
			<Icon icon={Cancel01Icon} size={12} strokeWidth={2} />
		</button>
	{/if}
</div>

<style>
	/* A quiet fill in the header that only asks for attention once it's in use. */
	.search {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex: 0 1 auto;
		width: 14rem;
		min-width: 9rem;
		height: 2rem;
		padding: 0 0.3rem 0 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: var(--surface-2);
		color: var(--text-3);
		transition:
			width var(--dur) var(--ease-out),
			background-color var(--dur-fast) ease,
			border-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease;
	}

	.search:hover {
		border-color: var(--line);
	}

	.search.open {
		width: 25rem;
	}

	.search:focus-within {
		background: var(--surface);
		border-color: color-mix(in oklch, var(--accent) 70%, var(--line-strong));
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 16%, transparent);
	}

	.search :global(.glass) {
		margin-right: 0.25rem;
		transition: color var(--dur-fast) ease;
	}

	.search:focus-within :global(.glass),
	.search.active :global(.glass) {
		color: var(--text-2);
	}

	.query {
		flex: 1;
		min-width: 3rem;
		height: 100%;
		background: transparent;
		border: 0;
		font-size: 0.8125rem;
		color: var(--text);
	}

	.query:focus {
		outline: none;
	}

	.query::-webkit-search-cancel-button {
		display: none;
	}

	.hint {
		margin-right: 0.2rem;
		padding: 0 0.3rem;
		border-radius: 4px;
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--line);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		line-height: 1.1rem;
		color: var(--text-3);
		pointer-events: none;
	}

	.count {
		flex-shrink: 0;
		padding: 0 0.3rem;
		font-size: 0.6875rem;
		color: var(--text-3);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.count b {
		font-weight: 600;
		color: var(--text-2);
	}

	.mini {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 5px;
		color: var(--text-3);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.mini:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--text);
	}

	.mini:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.tick:hover:not(:disabled) {
		color: var(--accent-text);
	}

	.divider {
		flex-shrink: 0;
		width: 1px;
		height: 0.9rem;
		margin: 0 0.15rem;
		background: var(--line-strong);
	}

	.scope {
		display: flex;
		flex-shrink: 0;
		animation: fade-in var(--dur) ease;
	}
</style>
