<script lang="ts">
	import { tick, untrack } from 'svelte';
	import {
		Add01Icon,
		AlertCircleIcon,
		Delete02Icon,
		MoreHorizontalIcon,
		PencilEdit02Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import type { Workspace } from '$lib/state/workspace.svelte';
	import type { Column } from '$lib/core/types';
	import { cellKey, excerpt, splitByRanges } from '$lib/core/search';
	import { countValues, formatShare, type ValueCount } from '$lib/core/counts';
	import { detectKind, isCategorical, labelTone } from '$lib/core/columns';
	import { kindIcons, kindNames } from './kinds';

	interface Props {
		ws: Workspace;
		onInsert: (column: Column) => void;
		/**
		 * Width in pixels of whatever floats over the grid's right edge (the frosted
		 * sidebar). The grid adds that much room at the end of each row so the last
		 * column can be scrolled clear, and treats that strip as off screen.
		 */
		occludedRight?: number;
	}

	let { ws, onInsert, occludedRight = 0 }: Props = $props();

	const ROW_HEIGHT = 34;
	const HEADER_HEIGHT = 36;
	const OVERSCAN = 8;

	let scroller = $state<HTMLDivElement | null>(null);
	let viewportHeight = $state(600);
	let scrollTop = $state(0);

	let menuColumnId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let renameError = $state('');
	let focusRow = $state(0);
	let focusCol = $state(0);

	const rows = $derived(ws.rows);
	const columns = $derived(ws.columns);

	/**
	 * Wide enough for the longest sampled value, and for the header too: its type
	 * icon, name and menu button, so short-valued columns don't cut their own names.
	 */
	const widths = $derived(
		columns.map((column) => {
			const sample = rows.slice(0, 40);
			const longest = sample.reduce(
				(max, row) => Math.max(max, (row.cells[column.id] ?? '').length),
				0
			);
			const content = longest * 7.1 + 32;
			const header = column.name.length * 7 + 72;
			return Math.round(Math.max(112, Math.min(340, Math.max(content, header))));
		})
	);

	const gridTemplate = $derived(
		[
			'2.75rem',
			...widths.map((width) => `${width}px`),
			...(occludedRight > 0 ? [`${Math.round(occludedRight)}px`] : [])
		].join(' ')
	);

	const firstVisible = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
	const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
	const visible = $derived(rows.slice(firstVisible, firstVisible + visibleCount));
	const allSelected = $derived(rows.length > 0 && ws.selected.size === rows.length);
	const someSelected = $derived(ws.selected.size > 0 && !allSelected);
	const currentMatch = $derived(ws.currentMatch);
	const activeCell = $derived(ws.activeCell);

	/** Per column, in column order: what it holds, and whether its values read as labels. */
	const meta = $derived(
		columns.map((column) => ({
			kind: detectKind(column, rows),
			labels: column.generated && isCategorical(column, rows)
		}))
	);

	let scrolled = $state(false);

	// A run puts its answers in a column that may sit off to the right, even under the
	// sidebar. Bring it into view as the run starts so the answers can be watched.
	$effect(() => {
		const started = ws.runStartedAt;
		if (!started) return;
		untrack(() => {
			const index = columns.findIndex((column) => column.id === ws.lastRunColumnId);
			if (index !== -1) revealColumn(index);
		});
	});

	// Tallied only while a column menu is open, and live, so it shows a run's progress.
	const menuCounts = $derived(menuColumnId ? countValues(rows, menuColumnId) : null);
	// When every value is different (IDs, free text) a tally says nothing, so past a
	// handful of values it collapses to a note.
	const countsUseful = $derived(
		menuCounts !== null &&
			(menuCounts.values.some((entry) => entry.count > 1) ||
				menuCounts.values.length + menuCounts.others.distinct <= 3)
	);

	/**
	 * The menu lives in the sticky header, so anything past the grid's bottom edge
	 * can't be scrolled to. Cap it at the room the grid actually has.
	 */
	let menuMaxHeight = $state(420);

	function toggleMenu(columnId: string) {
		if (menuColumnId === columnId) {
			menuColumnId = null;
			return;
		}
		const room = (scroller?.clientHeight ?? 460) - HEADER_HEIGHT - 12;
		menuMaxHeight = Math.max(140, room);
		menuColumnId = columnId;
	}

	function tickValue(entry: ValueCount) {
		ws.tickRows(entry.rowIds);
		menuColumnId = null;
	}

	// Scroll to the current match only when the search asks for it, not every time
	// the data changes underneath (a run writing cells would otherwise yank the view).
	$effect(() => {
		const token = ws.searchReveal;
		if (!token) return;
		untrack(() => {
			const match = ws.currentMatch;
			if (!match) return;
			focusRow = match.rowIndex;
			focusCol = match.columnIndex;
			ws.setActiveCell(match.rowId, match.columnId);
			reveal(match.rowIndex, match.columnIndex);
		});
	});

	function measure(node: HTMLDivElement) {
		const observer = new ResizeObserver(() => {
			const previous = viewportHeight;
			viewportHeight = node.clientHeight;
			// When the grid gets shorter (a phone keyboard opening, the window shrinking),
			// keep the selected row on screen if it was, instead of letting it drop away.
			if (viewportHeight >= previous) return;
			const top = focusRow * ROW_HEIGHT;
			const bottom = top + ROW_HEIGHT;
			const wasVisible =
				top >= node.scrollTop && bottom <= node.scrollTop + previous - HEADER_HEIGHT;
			const bodyHeight = viewportHeight - HEADER_HEIGHT;
			if (wasVisible && bottom > node.scrollTop + bodyHeight) node.scrollTop = bottom - bodyHeight;
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

	async function startEdit(rowId: string, columnId: string) {
		if (ws.isBusy) return;
		ws.startEditing(rowId, columnId);
		await tick();
		const input = document.querySelector<HTMLInputElement>('[data-cell-input]');
		input?.focus();
		input?.select();
	}

	/**
	 * Ends an edit from the keyboard and hands focus back to the cell, so the arrow
	 * keys carry on from where the edit was.
	 */
	async function finishEdit(save: boolean) {
		if (save) ws.commitEditing();
		else ws.cancelEditing();
		await tick();
		document
			.querySelector<HTMLElement>(`[data-cell="${focusRow}-${focusCol}"]`)
			?.focus({ preventScroll: true });
	}

	/**
	 * Scrolls just enough to bring a cell out from under the sticky header, the
	 * gutter, and anything floating over the right edge.
	 */
	function reveal(rowIndex: number, columnIndex: number) {
		if (!scroller) return;
		const top = rowIndex * ROW_HEIGHT;
		const bodyHeight = scroller.clientHeight - HEADER_HEIGHT;
		if (top < scroller.scrollTop) scroller.scrollTop = top;
		else if (top + ROW_HEIGHT > scroller.scrollTop + bodyHeight) {
			scroller.scrollTop = top + ROW_HEIGHT - bodyHeight;
		}

		revealColumn(columnIndex);
	}

	/** Scrolls sideways just enough to bring a column clear of the gutter and the sidebar. */
	function revealColumn(columnIndex: number) {
		if (!scroller) return;
		const gutter = scroller.querySelector<HTMLElement>('.head-cell.gutter')?.offsetWidth ?? 56;
		const left = gutter + widths.slice(0, columnIndex).reduce((sum, width) => sum + width, 0);
		const right = left + (widths[columnIndex] ?? 0);
		const visibleWidth = scroller.clientWidth - occludedRight;
		if (left - gutter < scroller.scrollLeft) scroller.scrollLeft = left - gutter;
		else if (right > scroller.scrollLeft + visibleWidth) {
			// A column wider than the clear area lines up by its left edge instead.
			scroller.scrollLeft = Math.min(left - gutter, right - visibleWidth);
		}
	}

	/** Roving tabindex: one stop for the whole grid, arrow keys move inside it. */
	async function moveFocus(rowStep: number, colStep: number) {
		focusRow = Math.max(0, Math.min(rows.length - 1, focusRow + rowStep));
		focusCol = Math.max(0, Math.min(columns.length - 1, focusCol + colStep));
		reveal(focusRow, focusCol);
		await tick();
		document
			.querySelector<HTMLElement>(`[data-cell="${focusRow}-${focusCol}"]`)
			?.focus({ preventScroll: true });
	}

	function onGridKeydown(event: KeyboardEvent) {
		if (ws.editingCell) return;
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
			void startEdit(row.id, column.id);
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

{#snippet countItem(entry: ValueCount, label: string, total: number)}
	{@const share = formatShare(entry.count, total)}
	{@const rowWord = entry.count === 1 ? 'row' : 'rows'}
	<button
		type="button"
		role="menuitem"
		class={['count', !label && 'empty']}
		aria-label={`${label || 'Empty'}: ${entry.count} ${rowWord}, ${share}. Tick them.`}
		disabled={ws.isBusy}
		onclick={() => tickValue(entry)}
	>
		<span class="value">{label || 'Empty'}</span>
		<span class="num">{entry.count}</span>
		<span class="share">{share}</span>
	</button>
{/snippet}

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			menuColumnId = null;
			renamingId = null;
			ws.cancelEditing();
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
	class:scrolled
	onscroll={() => {
		scrollTop = scroller?.scrollTop ?? 0;
		scrolled = scrollTop > 0;
	}}
	onkeydown={onGridKeydown}
>
	<div class="head" role="row" style="grid-template-columns: {gridTemplate}">
		<div class="head-cell gutter" role="columnheader">
			<input
				type="checkbox"
				checked={allSelected}
				indeterminate={someSelected}
				onchange={(event) => ws.selectAll(event.currentTarget.checked)}
				aria-label="Select every row"
			/>
		</div>
		{#each columns as column, columnIndex (column.id)}
			{@const kind = meta[columnIndex]?.kind ?? 'text'}
			<div
				class="head-cell"
				role="columnheader"
				class:generated={column.generated}
				class:numeric={kind === 'number'}
				class:active-col={activeCell?.columnId === column.id}
			>
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
						use:tooltip={`${kindNames[kind]}. Click to add {{${column.name}}} to the prompt.`}
						onclick={() => onInsert(column)}
					>
						<span class="kind">
							<Icon icon={kindIcons[kind]} size={13} />
						</span>
						<span class="truncate">{column.name}</span>
						<Icon icon={Add01Icon} size={12} class="add-hint" strokeWidth={2} />
					</button>
					<button
						type="button"
						class="head-menu"
						class:open={menuColumnId === column.id}
						aria-label={`Options for ${column.name}`}
						onclick={() => toggleMenu(column.id)}
					>
						<Icon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />
					</button>
				{/if}

				{#if menuColumnId === column.id}
					<div class="menu pop" role="menu" style:max-height="{menuMaxHeight}px">
						<button type="button" role="menuitem" onclick={() => startRename(column)}>
							<Icon icon={PencilEdit02Icon} size={14} /> Rename
						</button>
						<button
							type="button"
							role="menuitem"
							onclick={() => {
								onInsert(column);
								menuColumnId = null;
							}}
						>
							<Icon icon={Add01Icon} size={14} /> Add to prompt
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
							<Icon icon={Delete02Icon} size={14} /> Delete column
						</button>
						{#if menuCounts}
							<div class="divider" role="separator"></div>
							<div class="counts-head">
								<span>{column.generated ? 'Answers' : 'Values'}</span>
								<span>{menuCounts.total} {menuCounts.total === 1 ? 'row' : 'rows'}</span>
							</div>
							<!-- The actions above stay put; a long tally scrolls on its own. -->
							<div class="counts">
								{#if countsUseful}
									{#each menuCounts.values as entry (entry.value)}
										{@render countItem(entry, entry.value, menuCounts.total)}
									{/each}
									{#if menuCounts.others.distinct}
										<p class="counts-note">
											{menuCounts.others.distinct} other
											{menuCounts.others.distinct === 1 ? 'value' : 'values'},
											{menuCounts.others.count}
											{menuCounts.others.count === 1 ? 'row' : 'rows'}
										</p>
									{/if}
								{:else}
									<p class="counts-note">Every row has a different value.</p>
								{/if}
								{#if menuCounts.empty}
									{@render countItem(menuCounts.empty, '', menuCounts.total)}
								{/if}
							</div>
						{/if}
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
					<div class="cell gutter" role="gridcell" class:active-row={activeCell?.rowId === row.id}>
						<input
							type="checkbox"
							checked={ws.selected.has(row.id)}
							onchange={() => ws.toggleRow(row.id)}
							aria-label={`Select row ${rowIndex + 1}`}
						/>
						<span class="rownum">{rowIndex + 1}</span>
					</div>
					{#each columns as column, columnIndex (column.id)}
						{@const value = row.cells[column.id] ?? ''}
						{@const tone = cellTone(row.id, column.id)}
						{@const match = ws.search.byCell.get(cellKey(row.id, column.id))}
						<div
							class={[
								'cell',
								tone,
								column.generated && 'generated',
								rowIndex === focusRow && columnIndex === focusCol && 'focused',
								match && 'hit',
								match && match === currentMatch && 'current',
								meta[columnIndex]?.kind === 'number' && 'numeric',
								activeCell?.rowId === row.id && activeCell.columnId === column.id && 'active',
								ws.isEditing(row.id, column.id) && 'editing',
								column.id === ws.lastRunColumnId && ws.recentlyWritten.has(row.id) && 'landed'
							]}
							role="gridcell"
							data-cell={`${rowIndex}-${columnIndex}`}
							tabindex={rowIndex === focusRow && columnIndex === focusCol ? 0 : -1}
							aria-colindex={columnIndex + 2}
							onfocus={() => {
								focusRow = rowIndex;
								focusCol = columnIndex;
								ws.setActiveCell(row.id, column.id);
							}}
							ondblclick={() => startEdit(row.id, column.id)}
						>
							{#if ws.isEditing(row.id, column.id)}
								<input
									data-cell-input
									class="cell-input"
									bind:value={ws.editDraft}
									onblur={() => ws.commitEditing()}
									onkeydown={(event) => {
										// Stop here: the grid reads Enter as "edit this cell" and would
										// reopen the cell that was just saved.
										if (event.key === 'Enter') {
											event.preventDefault();
											event.stopPropagation();
											void finishEdit(true);
										} else if (event.key === 'Escape') {
											event.stopPropagation();
											void finishEdit(false);
										}
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
								<span class="failed" use:tooltip={ws.cellError.get(row.id) ?? 'Failed'}>
									<Icon icon={AlertCircleIcon} size={13} />
									{ws.cellError.get(row.id) ?? 'Failed'}
								</span>
							{:else if match}
								{@const shown = excerpt(value, match.ranges)}
								<span class={['value', meta[columnIndex]?.labels && `tag tone-${labelTone(value)}`]}
									>{#each splitByRanges(shown.text, shown.ranges) as piece, index (index)}{#if piece.hit}<mark
												>{piece.text}</mark
											>{:else}{piece.text}{/if}{/each}</span
								>
							{:else if meta[columnIndex]?.labels && value}
								<span class="value tag tone-{labelTone(value)}">{value}</span>
							{:else}
								<span class="value">{value}</span>
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
		transition: box-shadow var(--dur) ease;
	}

	/* Once rows slide under it, the header lifts off them. */
	.scrolled .head {
		box-shadow: 0 8px 16px -12px oklch(0.1 0 0 / 0.35);
	}

	.head-cell {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		height: 36px;
		padding-inline: 0.45rem;
		border-right: 1px solid var(--line);
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.005em;
		color: var(--text-2);
	}

	.kind {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		color: var(--text-3);
	}

	.head-cell.generated .kind {
		color: var(--accent-text);
	}

	.head-cell.numeric .head-name {
		justify-content: flex-end;
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

	/* Quiet until wanted: shown on hover, keyboard focus, or while its menu is open. */
	.head-menu {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 5px;
		color: var(--text-3);
		flex-shrink: 0;
		opacity: 0;
		transition:
			opacity var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}

	.head-cell:hover .head-menu,
	.head-menu:focus-visible,
	.head-menu.open {
		opacity: 1;
	}

	@media (hover: none) {
		.head-menu {
			opacity: 1;
		}
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

	/* The prompt's column carries a faint wash of the accent, top to bottom. */
	.cell.generated {
		background: color-mix(in oklch, var(--accent-soft) 45%, transparent);
	}

	/* An answer arriving glows for a moment, then settles into the column's wash. */
	/* An overlay rather than the cell's own shadow, so selection rings stay put. */
	.cell.landed {
		position: relative;
	}

	.cell.landed::after {
		content: '';
		position: absolute;
		inset: 0;
		background: color-mix(in oklch, var(--accent) 38%, transparent);
		pointer-events: none;
		animation: land 900ms var(--ease-out) forwards;
	}

	@keyframes land {
		to {
			opacity: 0;
		}
	}

	.cell.numeric {
		justify-content: flex-end;
		font-variant-numeric: tabular-nums;
	}

	/* Row numbers, with each row's checkbox waiting underneath: it shows on hover or
	   keyboard focus, and stays once the row is ticked. */
	.gutter {
		position: sticky;
		left: 0;
		z-index: 8;
		display: grid;
		place-items: center;
		padding: 0;
		background: var(--surface-2);
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
	}

	.gutter > :global(*) {
		grid-area: 1 / 1;
	}

	.cell.gutter input,
	.rownum {
		transition: opacity var(--dur-fast) ease;
	}

	.cell.gutter input {
		opacity: 0;
	}

	.row:hover .gutter input,
	.gutter input:checked,
	.gutter input:focus-visible {
		opacity: 1;
	}

	.row:hover .rownum,
	.gutter:has(input:checked) .rownum,
	.gutter:has(input:focus-visible) .rownum {
		opacity: 0;
	}

	@media (hover: none) {
		.cell.gutter input {
			opacity: 1;
		}

		.rownum {
			display: none;
		}
	}

	.row.selected .gutter {
		background: var(--accent-soft);
	}

	/* Drawn over the checkbox, so clicks must pass through the number to reach it. */
	.rownum {
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Borderless and filling the cell, so the text stays exactly where it was; the
	   cell's own ring shows that it is open for typing. */
	.cell-input {
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		outline: none;
	}

	.cell-input::selection {
		background: var(--hit);
	}

	.cell.focused:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 0;
	}

	/* The selected cell, the one the cell reader shows. */
	.cell.active {
		box-shadow: inset 0 0 0 2px var(--active-ring);
	}

	.cell.hit mark {
		background: var(--hit);
		color: inherit;
		border-radius: 2px;
	}

	.cell.current {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.cell.current mark {
		background: var(--accent);
		color: var(--accent-ink);
	}

	/* Open for typing: a solid ring and halo lifted over the neighbouring cells, on a
	   plain ground so a ticked row's tint can't swallow the text selection. */
	.cell.editing {
		position: relative;
		z-index: 3;
		background: var(--surface);
		box-shadow:
			inset 0 0 0 2px var(--accent),
			0 0 0 3px var(--accent-soft);
	}

	/* Mark the selected cell's column and row, the way a spreadsheet does. */
	.head-cell.active-col {
		color: var(--text);
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.head-cell.generated.active-col {
		color: var(--accent-text);
	}

	.gutter.active-row {
		box-shadow: inset -2px 0 0 var(--accent);
	}

	.gutter.active-row .rownum {
		color: var(--accent-text);
		font-weight: 600;
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
		display: flex;
		flex-direction: column;
		min-width: 14rem;
		max-width: 18rem;
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

	.counts {
		display: grid;
		min-height: 0;
		overflow-y: auto;
	}

	.divider {
		height: 1px;
		margin: 0.25rem 0.2rem;
		background: var(--line);
	}

	.counts-head {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0.45rem 0.2rem;
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.menu .count {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 2.75rem;
		gap: 0.75rem;
	}

	.count .value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count.empty .value {
		color: var(--text-3);
	}

	.count .num,
	.count .share {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.count .share {
		color: var(--text-3);
	}

	.counts-note {
		padding: 0.25rem 0.45rem 0.3rem;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--text-3);
	}

	.menu .danger {
		color: var(--danger);
	}
</style>
