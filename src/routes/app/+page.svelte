<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		AiMagicIcon,
		ArrowRight01Icon,
		Cancel01Icon,
		CheckmarkSquare02Icon,
		GridTableIcon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import Brand from '$lib/components/Brand.svelte';
	import CellReader from '$lib/components/CellReader.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import DataGrid from '$lib/components/DataGrid.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import SidebarResizer from '$lib/components/SidebarResizer.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/state/toast.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { downloadFile, exportFilename, type ExportFormat } from '$lib/core/export';
	import { Workspace } from '$lib/state/workspace.svelte';
	import { models } from '$lib/state/models.svelte';
	import { session } from '$lib/state/session.svelte';
	import { sidebar } from '$lib/state/sidebar.svelte';
	import type { Column } from '$lib/core/types';

	const ws = new Workspace();
	let composer = $state<Composer | null>(null);
	let searchBar = $state<SearchBar | null>(null);
	let view = $state<'sheet' | 'prompt'>('sheet');

	// Wide windows put the panel beside the sheet. Narrower ones switch between
	// them with tabs, the panel laid over the whole sheet as frosted glass; the
	// sheet stays drawn so it shows through, but it can't be reached.
	const wide = new MediaQuery('min-width: 1024px');
	const sheetCovered = $derived(!wide.current && view === 'prompt');
	let loadedId = $state('');

	$effect(() => {
		void session.init();
		sidebar.load();
	});

	$effect(() => {
		const id = page.url.searchParams.get('p') ?? '';
		if (!id || id === loadedId) return;
		loadedId = id;
		void ws.load(id);
	});

	$effect(() => {
		if (!models.checkedAt) void models.scan();
	});

	// Keeps the model list and the saved config in step when a project opens.
	$effect(() => {
		const project = ws.project;
		if (!project || !models.models.length) return;
		const known = models.models.some((model) => model.name === project.config.model);
		if (!known) project.config.model = models.models[0].name;
	});

	onDestroy(() => {
		ws.dispose();
		toast.dismiss();
	});

	// Looking at the sheet on a narrow screen, the run's panel is out of sight: say when a run ends.
	let previousRunState = ws.runState;
	$effect(() => {
		const state = ws.runState;
		const ended = previousRunState === 'running' && (state === 'done' || state === 'stopped');
		previousRunState = state;
		if (!ended || wide.current || view !== 'sheet') return;
		const column = ws.columns.find((candidate) => candidate.id === ws.lastRunColumnId)?.name;
		const written = `${ws.runDone} ${ws.runDone === 1 ? 'row' : 'rows'} written`;
		toast.show(column ? `${written} to ${column}` : written, ws.runFailed ? 'info' : 'success');
	});

	function exportSheet(format: ExportFormat) {
		if (!ws.project) return;
		const filename = exportFilename(ws.project.name, ws.project.fileName, format);
		downloadFile(filename, format, ws.exportAs(format));
		toast.show(`Exported ${filename}`);
	}

	function insert(column: Column) {
		view = 'prompt';
		composer?.insertColumn(column);
	}

	/**
	 * The grid only renders rows on screen, so the browser's own find would miss
	 * most of the sheet. Take over its shortcuts while a sheet is open, and add
	 * ⌘↵ / Ctrl ↵ to run the prompt.
	 */
	async function onShortcut(event: KeyboardEvent) {
		if (!ws.project || !(event.metaKey || event.ctrlKey) || event.altKey) return;
		const key = event.key.toLowerCase();
		if (key === 'f') {
			event.preventDefault();
			view = 'sheet';
			await tick();
			searchBar?.focus();
		} else if (key === 'g' && ws.searchQuery.trim()) {
			event.preventDefault();
			ws.stepSearch(event.shiftKey ? -1 : 1);
		} else if (key === 'enter' && !ws.isBusy) {
			event.preventDefault();
			composer?.run();
		}
	}

	// The name field sizes itself to the name where the browser can; elsewhere, a close guess.
	const fitsContent = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');

	const generatedCount = $derived(ws.columns.filter((column) => column.generated).length);
</script>

<svelte:window onkeydown={onShortcut} />

<Toast />

<svelte:head>
	<title>{ws.project ? `${ws.project.name} | prompt2column` : 'prompt2column'}</title>
</svelte:head>

<!--
	Two columns on a wide screen, each with its own header: the panel under the
	project's name on the left, the sheet under its tools on the right.
-->
<div class="app" style:--side-width="{sidebar.shown}px">
	<header class="brandbar">
		<a href={resolve('/')} class="home" aria-label="Back to projects">
			<Brand markOnly />
		</a>
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href={resolve('/')} class="crumb">Projects</a>
			<Icon icon={ArrowRight01Icon} size={12} strokeWidth={2} class="sep" />
			{#if ws.project}
				<input
					class="name"
					value={ws.project.name}
					style:width={fitsContent ? undefined : `${Math.min(ws.project.name.length + 2, 34)}ch`}
					aria-label="Project name"
					onchange={(event) => ws.rename(event.currentTarget.value)}
				/>
			{/if}
		</nav>
	</header>

	<header class="toolbar">
		{#if ws.project}
			<p class="stats" aria-label="Sheet size">
				<span><b>{ws.rows.length}</b> rows</span>
				<span><b>{ws.columns.length}</b> columns</span>
				{#if generatedCount}
					<span class="generated">
						<Icon icon={AiMagicIcon} size={12} />
						<b>{generatedCount}</b> generated
					</span>
				{/if}
			</p>
		{/if}

		{#if ws.selected.size}
			<!-- How many rows a "Ticked rows" run would take, with a quick way out. -->
			<span class="ticked" role="status">
				<Icon icon={CheckmarkSquare02Icon} size={13} />
				<b>{ws.selected.size}</b> ticked
				<button
					type="button"
					class="untick"
					aria-label="Untick every row"
					disabled={ws.isBusy}
					use:tooltip={'Untick every row'}
					onclick={() => ws.selectAll(false)}
				>
					<Icon icon={Cancel01Icon} size={11} strokeWidth={2.2} />
				</button>
			</span>
		{/if}

		<div class="actions">
			{#if ws.project}
				<span class="find">
					<SearchBar bind:this={searchBar} {ws} />
				</span>
			{/if}
			<ExportMenu disabled={!ws.project} onExport={exportSheet} />
			<ThemeToggle />
		</div>
	</header>

	{#if ws.loading}
		<div class="message text-sm text-ink-3">Opening the sheet</div>
	{:else if ws.loadError}
		<div class="message px-6">
			<div class="max-w-sm text-center">
				<p class="text-sm font-medium text-ink">{ws.loadError}</p>
				<button class="btn btn-soft mt-4" onclick={() => goto(resolve('/'))}>
					Back to projects
				</button>
			</div>
		</div>
	{:else if ws.project}
		<div class="tabs">
			<button class:on={view === 'sheet'} onclick={() => (view = 'sheet')}>
				<Icon icon={GridTableIcon} size={15} /> Sheet
			</button>
			<button class:on={view === 'prompt'} onclick={() => (view = 'prompt')}>
				<Icon icon={AiMagicIcon} size={15} /> Prompt
			</button>
		</div>

		<div class={['pane', 'side', view !== 'prompt' && 'hide']}>
			{#if wide.current}
				<SidebarResizer />
			{/if}
			<Composer bind:this={composer} {ws} />
		</div>

		<div class="pane sheet" inert={sheetCovered}>
			<CellReader {ws} />
			<DataGrid {ws} onInsert={insert} />
		</div>
	{/if}
</div>

<style>
	/* Narrow first: one column, with the panel and the sheet sharing the main cell.
	   minmax(0, 1fr) stops any child's natural width from widening the page. */
	.app {
		display: grid;
		height: 100dvh;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: 3.25rem auto minmax(0, 1fr);
		grid-template-areas:
			'brand toolbar'
			'tabs tabs'
			'main main';
	}

	.brandbar,
	.toolbar {
		display: flex;
		align-items: center;
		min-width: 0;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	.brandbar {
		grid-area: brand;
		gap: 0.6rem;
		padding: 0 0.5rem 0 0.9rem;
	}

	.toolbar {
		grid-area: toolbar;
		gap: 0.75rem;
		padding: 0 0.75rem 0 0.5rem;
		container-type: inline-size;
	}

	.home {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		border-radius: 7px;
	}

	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}

	.crumb {
		flex-shrink: 0;
		padding: 0.2rem 0.35rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		color: var(--text-3);
		transition:
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}

	.crumb:hover {
		color: var(--text);
		background: var(--field);
	}

	.crumbs :global(.sep) {
		color: var(--text-3);
		opacity: 0.6;
	}

	/* Shrinks on phones so the header never pushes the page wider than the screen. */
	.name {
		field-sizing: content;
		flex: 0 1 auto;
		min-width: 4rem;
		max-width: 20rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0.2rem 0.4rem;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
		transition:
			border-color var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}

	.name:hover {
		background: var(--field);
	}

	.name:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--surface);
		box-shadow: var(--ring);
	}

	/* The sheet's size as a line of quiet text, not a row of badges. */
	.stats {
		display: none;
		align-items: center;
		gap: 0.9rem;
		padding-left: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-3);
		white-space: nowrap;
	}

	.stats span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.stats b {
		font-family: var(--font-mono);
		font-weight: 500;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.stats .generated,
	.stats .generated b {
		color: var(--accent-text);
	}

	@container (min-width: 720px) {
		.stats {
			display: flex;
		}
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
	}

	.ticked {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		height: 1.4rem;
		padding: 0 0.2rem 0 0.5rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-text);
		font-size: 0.6875rem;
		white-space: nowrap;
		animation: pop-in var(--dur) var(--ease-out);
	}

	.ticked b {
		font-family: var(--font-mono);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.untick {
		display: grid;
		place-items: center;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 999px;
		color: inherit;
		transition: background-color var(--dur-fast) ease;
	}

	.untick:hover:not(:disabled) {
		background: color-mix(in oklch, var(--accent) 30%, transparent);
	}

	.find {
		display: flex;
		min-width: 0;
	}

	/* A desktop app first (Ollama doesn't run on phones); a narrow window just
	   drops the extras rather than scrolling sideways. */
	@media (max-width: 639px) {
		.crumb,
		.crumbs :global(.sep),
		.find {
			display: none;
		}
	}

	.message {
		grid-area: main;
		display: grid;
		place-items: center;
	}

	.tabs {
		grid-area: tabs;
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}

	.tabs button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.5rem;
		font-size: 0.8125rem;
		color: var(--text-2);
		border-bottom: 2px solid transparent;
	}

	.tabs button.on {
		color: var(--text);
		border-bottom-color: var(--accent);
		font-weight: 500;
	}

	.pane {
		grid-area: main;
		min-height: 0;
		min-width: 0;
	}

	/* Cell reader, then the grid. */
	.pane.sheet {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
	}

	/* Narrow: the Prompt tab lays the panel over the sheet, the Sheet tab removes it.
	   Layers: grid header and gutter stay below 20, the panel is 20, popovers 40. */
	.pane.side {
		z-index: 20;
		background: var(--surface);
	}

	.pane.side.hide {
		display: none;
	}

	@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
		.pane.side {
			background: var(--glass);
			-webkit-backdrop-filter: blur(6px) saturate(1.4);
			backdrop-filter: blur(6px) saturate(1.4);
			--composer-bg: transparent;
			--dock-bg: var(--glass-footer);
		}
	}

	@media (prefers-reduced-transparency: reduce) {
		.pane.side {
			background: var(--surface);
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			--dock-bg: var(--surface);
		}
	}

	/* Wide: no tabs. The panel takes the left column under the project's name, a
	   resizable width, and one hairline from the top of the window to the bottom
	   keeps it apart from the sheet. Scoped rules outrank Tailwind utilities, so
	   the breakpoint lives here. */
	@media (min-width: 1024px) {
		.app {
			grid-template-columns: var(--side-width, 24rem) minmax(0, 1fr);
			grid-template-rows: 3.25rem minmax(0, 1fr);
			grid-template-areas:
				'brand toolbar'
				'side sheet';
		}

		.brandbar {
			border-right: 1px solid var(--line);
		}

		.toolbar {
			padding-left: 0.5rem;
		}

		.tabs {
			display: none;
		}

		.message {
			grid-area: side / side / sheet / sheet;
		}

		.pane.side,
		.pane.side.hide {
			grid-area: side;
			position: relative;
			display: block;
			z-index: auto;
			border-right: 1px solid var(--line);
			background: var(--surface);
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			--composer-bg: var(--surface);
			--dock-bg: var(--surface);
		}

		.pane.sheet {
			grid-area: sheet;
		}
	}
</style>
