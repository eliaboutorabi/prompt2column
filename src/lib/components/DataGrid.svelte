<script lang="ts">
	import { tick } from 'svelte';
	import { DotsThree, PencilSimple, Plus, Trash, WarningCircle } from 'phosphor-svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';
	import type { Column } from '$lib/core/types';

	interface Props {
		ws: Workspace;
		onInsert: (column: Column) => void;
	}

	let { ws, onInsert }: Props = $props();

	const ROW_HEIGHT = 34;
	const OVERSCAN = 8;

	let scroller = $state<HTMLDivElement | null>(null);
	let viewportHeight = $state(600);
	let scrollTop = $state(0);

	let menuColumnId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let renameError = $state('');
	let editing = $state<{ rowId: string; columnId: string } | null>(null);
	let editValue = $state('');
	let focusRow = $state(0);
	let focusCol = $state(0);

	const rows = $derived(ws.rows);
	const columns = $derived(ws.columns);

	const widths = $derived(
		columns.map((column) => {
			const sample = rows.slice(0, 40);
			const longest = sample.reduce(
				(max, row) => Math.max(max, (row.cells[column.id] ?? '').length),
				column.name.length + 4
			);
			return Math.round(Math.max(112, Math.min(340, longest * 7.1 + 28)));
		})
	);

	const gridTemplate = $derived(['3.5rem', ...widths.map((width) => `${width}px`)].join(' '));

	const firstVisible = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
	const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
	const visible = $derived(rows.slice(firstVisible, firstVisible + visibleCount));
	const allSelected = $derived(rows.length > 0 && ws.selected.size === rows.length);

	function measure(node: HTMLDivElement) {
		const observer = new ResizeObserver(() => {
			viewportHeight = node.clientHeight;
		});
		observer.observe(node);
		viewportHeight = node.clientHeight;
		return { destroy: () => observer.disconnect() };
	}

	function startRename(column: Column) {
		menuColumnId = null;
		renamingId = column.id;
		renameValue = column.name;
		renameError = '';
	}

	function commitRename() {
		if (!renamingId) return;
		const error = ws.renameColumn(renamingId, renameValue);
		if (error) {
			renameError = error;
			return;
		}
		renamingId = null;
		renameError = '';
	}

	async function startEdit(rowId: string, columnId: string, current: string) {
		if (ws.isBusy) return;
		editing = { rowId, columnId };
		editValue = current;
		await tick();
		const input = document.querySelector<HTMLInputElement>('[data-cell-input]');
		input?.focus();
		input?.select();
	}

	function commitEdit() {
		if (!editing) return;
		ws.setCell(editing.rowId, editing.columnId, editValue);
		editing = null;
	}

	/** Roving tabindex: one stop for the whole grid, arrow keys move inside it. */
	async function moveFocus(rowStep: number, colStep: number) {
		focusRow = Math.max(0, Math.min(rows.length - 1, focusRow + rowStep));
		focusCol = Math.max(0, Math.min(columns.length - 1, focusCol + colStep));
		const top = focusRow * ROW_HEIGHT;
		if (scroller) {
			if (top < scroller.scrollTop) scroller.scrollTop = top;
			else if (top + ROW_HEIGHT > scroller.scrollTop + viewportHeight - 36) {
				scroller.scrollTop = top + ROW_HEIGHT - viewportHeight + 36;
			}
		}
		await tick();
		document
			.querySelector<HTMLElement>(`[data-cell="${focusRow}-${focusCol}"]`)
			?.focus({ preventScroll: true });
	}

	function onGridKeydown(event: KeyboardEvent) {
		if (editing) return;
		const steps: Record<string, [number, number]> = {
			ArrowDown: [1, 0],
			ArrowUp: [-1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1]
		};
		const step = steps[event.key];
		if (step) {
			event.preventDefault();
			void moveFocus(step[0], step[1]);
			return;
		}
		if (event.key === 'Enter' || event.key === 'F2') {
			const row = rows[focusRow];
			const column = columns[focusCol];
			if (!row || !column) return;
			event.preventDefault();
			void startEdit(row.id, column.id, row.cells[column.id] ?? '');
		}
		if (event.key === ' ') {
			const row = rows[focusRow];
			if (!row) return;
			event.preventDefault();
			ws.toggleRow(row.id);
		}
	}

	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function cellTone(rowId: string, columnId: string) {
		if (columnId !== ws.lastRunColumnId) return '';
		return ws.cellStatus.get(rowId) ?? '';
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			menuColumnId = null;
			renamingId = null;
			editing = null;
		}
	}}
/>

<div
	class="scroller"
	role="grid"
	tabindex="-1"
	aria-label="Spreadsheet"
	aria-rowcount={rows.length + 1}
	aria-colcount={columns.length + 1}
	bind:this={scroller}
	use:measure
	onscroll={() => (scrollTop = scroller?.scrollTop ?? 0)}
	onkeydown={onGridKeydown}
>
	<div class="head" role="row" style="grid-template-columns: {gridTemplate}">
		<div class="head-cell gutter" role="columnheader">
			<input
				type="checkbox"
				class="size-3.5 accent-accent"
				checked={allSelected}
				onchange={(event) => ws.selectAll(event.currentTarget.checked)}
				aria-label="Select every row"
			/>
		</div>
		{#each columns as column (column.id)}
			<div class="head-cell" role="columnheader" class:generated={column.generated}>
				{#if renamingId === column.id}
					<input
						class="rename"
						bind:value={renameValue}
						onkeydown={(event) => {
							if (event.key === 'Enter') commitRename();
							if (event.key === 'Escape') renamingId = null;
						}}
						onblur={commitRename}
						aria-label="Column name"
						aria-invalid={renameError !== ''}
						use:autofocus
					/>
				{:else}
					<button
						type="button"
						class="head-name"
						title={`Add {{${column.name}}} to the prompt`}
						onclick={() => onInsert(column)}
					>
						<span class="truncate">{column.name}</span>
						<Plus size={12} weight="bold" class="add-hint" />
					</button>
					<button
						type="button"
						class="head-menu"
						aria-label={`Options for ${column.name}`}
						onclick={() => (menuColumnId = menuColumnId === column.id ? null : column.id)}
					>
						<DotsThree size={16} weight="bold" />
					</button>
				{/if}

				{#if menuColumnId === column.id}
					<div class="menu" role="menu">
						<button type="button" role="menuitem" onclick={() => startRename(column)}>
							<PencilSimple size={14} /> Rename
						</button>
						<button
							type="button"
							role="menuitem"
							onclick={() => {
								onInsert(column);
								menuColumnId = null;
							}}
						>
							<Plus size={14} /> Add to prompt
						</button>
						<button
							type="button"
							role="menuitem"
							class="danger"
							disabled={columns.length === 1}
							onclick={() => {
								ws.deleteColumn(column.id);
								menuColumnId = null;
							}}
						>
							<Trash size={14} /> Delete column
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if renameError}
		<p class="rename-error" role="alert">{renameError}</p>
	{/if}

	<div class="body" style="height: {rows.length * ROW_HEIGHT}px">
		<div class="rows" style="transform: translateY({firstVisible * ROW_HEIGHT}px)">
			{#each visible as row, offset (row.id)}
				{@const rowIndex = firstVisible + offset}
				<div
					class="row"
					role="row"
					aria-rowindex={rowIndex + 2}
					class:selected={ws.selected.has(row.id)}
					style="grid-template-columns: {gridTemplate}; height: {ROW_HEIGHT}px"
				>
					<div class="cell gutter" role="gridcell">
						<input
							type="checkbox"
							class="size-3.5 accent-accent"
							checked={ws.selected.has(row.id)}
							onchange={() => ws.toggleRow(row.id)}
							aria-label={`Select row ${rowIndex + 1}`}
						/>
						<span class="rownum">{rowIndex + 1}</span>
					</div>
					{#each columns as column, columnIndex (column.id)}
						{@const value = row.cells[column.id] ?? ''}
						{@const tone = cellTone(row.id, column.id)}
						<div
							class={[
								'cell',
								tone,
								column.generated && 'generated',
								rowIndex === focusRow && columnIndex === focusCol && 'focused'
							]}
							role="gridcell"
							data-cell={`${rowIndex}-${columnIndex}`}
							tabindex={rowIndex === focusRow && columnIndex === focusCol ? 0 : -1}
							aria-colindex={columnIndex + 2}
							onfocus={() => {
								focusRow = rowIndex;
								focusCol = columnIndex;
							}}
							ondblclick={() => startEdit(row.id, column.id, value)}
						>
							{#if editing && editing.rowId === row.id && editing.columnId === column.id}
								<input
									data-cell-input
									class="cell-input"
									bind:value={editValue}
									onblur={commitEdit}
									onkeydown={(event) => {
										if (event.key === 'Enter') commitEdit();
										if (event.key === 'Escape') editing = null;
									}}
									aria-label="Cell value"
								/>
							{:else if tone === 'running'}
								<span class="working" aria-label="Generating">
									<span class="bar"></span>
								</span>
							{:else if tone === 'queued' && value === ''}
								<span class="queued">waiting</span>
							{:else if tone === 'error'}
								<span class="failed" title={ws.cellError.get(row.id) ?? 'Failed'}>
									<WarningCircle size={13} weight="fill" />
									{ws.cellError.get(row.id) ?? 'Failed'}
								</span>
							{:else}
								<span class="value" title={value}>{value}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.scroller {
		position: relative;
		height: 100%;
		overflow: auto;
		background: var(--surface);
	}

	.head {
		position: sticky;
		top: 0;
		z-index: 12;
		display: grid;
		min-width: min-content;
		background: var(--surface-2);
		border-bottom: 1px solid var(--line-strong);
	}

	.head-cell {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		height: 36px;
		padding-inline: 0.5rem;
		border-right: 1px solid var(--line);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.head-cell.generated {
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.head-name {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
		text-align: left;
		border-radius: 4px;
		padding: 0.15rem 0.2rem;
	}

	.head-name :global(.add-hint) {
		opacity: 0;
		flex-shrink: 0;
		transition: opacity 0.14s ease;
	}

	.head-name:hover :global(.add-hint) {
		opacity: 0.7;
	}

	.head-name:hover {
		color: var(--text);
	}

	.head-menu {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		color: var(--text-3);
		flex-shrink: 0;
	}

	.head-menu:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.rename {
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 6px;
		padding: 0.15rem 0.35rem;
		font-size: 0.75rem;
		outline: none;
	}

	.rename-error {
		position: sticky;
		left: 0;
		background: var(--danger-soft);
		color: var(--danger);
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
	}

	.body {
		position: relative;
		min-width: min-content;
	}

	.rows {
		position: absolute;
		inset-inline: 0;
		top: 0;
		min-width: min-content;
		will-change: transform;
	}

	.row {
		display: grid;
		min-width: min-content;
		border-bottom: 1px solid var(--line);
	}

	.row:hover {
		background: var(--surface-2);
	}

	.row.selected {
		background: var(--accent-soft);
	}

	.cell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding-inline: 0.5rem;
		border-right: 1px solid var(--line);
		font-size: 0.8125rem;
		color: var(--text);
	}

	.cell.generated {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.gutter {
		position: sticky;
		left: 0;
		z-index: 8;
		justify-content: space-between;
		background: var(--surface-2);
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
	}

	.row.selected .gutter {
		background: var(--accent-soft);
	}

	.rownum {
		font-variant-numeric: tabular-nums;
	}

	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-input {
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 4px;
		padding: 0.1rem 0.3rem;
		font-size: 0.8125rem;
		outline: none;
	}

	.cell.focused:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 0;
	}

	.cell.error {
		background: var(--danger-soft);
	}

	.failed {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--danger);
		font-size: 0.6875rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queued {
		color: var(--text-3);
		font-size: 0.6875rem;
	}

	.working {
		display: block;
		width: 100%;
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.working .bar {
		display: block;
		width: 40%;
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		animation: slide 1.1s ease-in-out infinite;
	}

	@keyframes slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(250%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.working .bar {
			animation: none;
			width: 100%;
			opacity: 0.6;
		}
	}

	.menu {
		position: absolute;
		top: 34px;
		right: 0;
		z-index: 20;
		display: grid;
		min-width: 11rem;
		padding: 0.25rem;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pop);
	}

	.menu button {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.45rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--text);
		text-align: left;
	}

	.menu button:hover:not(:disabled) {
		background: var(--surface-2);
	}

	.menu button:disabled {
		opacity: 0.4;
	}

	.menu .danger {
		color: var(--danger);
	}
</style>
