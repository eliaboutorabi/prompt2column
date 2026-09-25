<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ArrowLeft, CheckCircle, Warning } from 'phosphor-svelte';
	import Composer from '$lib/components/Composer.svelte';
	import DataGrid from '$lib/components/DataGrid.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { downloadFile, exportFilename, type ExportFormat } from '$lib/core/export';
	import { Workspace } from '$lib/state/workspace.svelte';
	import { models } from '$lib/state/models.svelte';
	import { session } from '$lib/state/session.svelte';
	import type { Column } from '$lib/core/types';

	const ws = new Workspace();
	let composer = $state<Composer | null>(null);
	let searchBar = $state<SearchBar | null>(null);
	let view = $state<'sheet' | 'prompt'>('sheet');

	// On wide screens the composer floats over the sheet's right edge as frosted
	// glass. The grid needs its width to keep columns reachable from under it.
	const overlay = new MediaQuery('min-width: 1024px');
	let sidebarWidth = $state(0);
	const occludedRight = $derived(overlay.current ? sidebarWidth : 0);
	// On phones the Prompt tab lays the composer over the whole sheet. The sheet
	// stays drawn so it shows through the glass, but it can't be reached.
	const sheetCovered = $derived(!overlay.current && view === 'prompt');
	let loadedId = $state('');

	$effect(() => {
		void session.init();
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

	onDestroy(() => ws.dispose());

	function exportSheet(format: ExportFormat) {
		if (!ws.project) return;
		const filename = exportFilename(ws.project.name, ws.project.fileName, format);
		downloadFile(filename, format, ws.exportAs(format));
	}

	function insert(column: Column) {
		view = 'prompt';
		composer?.insertColumn(column);
	}

	/**
	 * The grid only renders rows on screen, so the browser's own find would miss
	 * most of the sheet. Take over its shortcuts while a sheet is open.
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
		}
	}

	const generatedCount = $derived(ws.columns.filter((column) => column.generated).length);
</script>

<svelte:window onkeydown={onShortcut} />

<svelte:head>
	<title>{ws.project ? `${ws.project.name} | prompt2column` : 'prompt2column'}</title>
</svelte:head>

<div class="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[3.25rem_1fr]">
	<header class="flex items-center gap-3 border-b border-line bg-surface px-3">
		<a href={resolve('/')} class="btn btn-ghost px-2" aria-label="Back to projects">
			<ArrowLeft size={16} />
		</a>

		{#if ws.project}
			<input
				class="name"
				value={ws.project.name}
				aria-label="Project name"
				onchange={(event) => ws.rename(event.currentTarget.value)}
			/>
			<span class="hidden font-mono text-xs text-ink-3 md:inline">
				{ws.rows.length} rows, {ws.columns.length} columns{generatedCount
					? `, ${generatedCount} generated`
					: ''}
			</span>
		{/if}

		<div class="ml-auto flex items-center gap-1">
			<span class="hidden items-center gap-1.5 text-xs text-ink-3 sm:flex">
				{#if models.loading}
					Looking for Ollama
				{:else if models.error}
					<Warning size={13} weight="fill" class="text-danger" /> Ollama offline
				{:else}
					<CheckCircle size={13} weight="fill" class="text-accent" />
					{models.models.length}
					{models.models.length === 1 ? 'model' : 'models'}
				{/if}
			</span>
			<ExportMenu disabled={!ws.project} onExport={exportSheet} />
			<ThemeToggle />
		</div>
	</header>

	{#if ws.loading}
		<div class="grid place-items-center text-sm text-ink-3">Opening the sheet</div>
	{:else if ws.loadError}
		<div class="grid place-items-center px-6">
			<div class="max-w-sm text-center">
				<p class="text-sm font-medium text-ink">{ws.loadError}</p>
				<button class="btn btn-outline mt-4" onclick={() => goto(resolve('/'))}>
					Back to projects
				</button>
			</div>
		</div>
	{:else if ws.project}
		<div class="workspace">
			<div class="tabs">
				<button class:on={view === 'sheet'} onclick={() => (view = 'sheet')}>Sheet</button>
				<button class:on={view === 'prompt'} onclick={() => (view = 'prompt')}>Prompt</button>
			</div>

			<div class="main">
				<div class="pane sheet" inert={sheetCovered}>
					<SearchBar bind:this={searchBar} {ws} {occludedRight} />
					<DataGrid {ws} onInsert={insert} {occludedRight} />
				</div>
				<div class={['pane', 'side', view !== 'prompt' && 'hide']} bind:offsetWidth={sidebarWidth}>
					<Composer bind:this={composer} {ws} />
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Shrinks on phones so the header never pushes the page wider than the screen. */
	.name {
		flex: 0 1 12rem;
		width: 0;
		min-width: 5rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0.2rem 0.4rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-overflow: ellipsis;
	}

	.name:hover {
		border-color: var(--line);
	}

	.name:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--surface);
	}

	/* minmax(0, 1fr) columns stop any child's natural width from widening the
	   page past a phone screen. */
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
	}

	/* Both panes share one cell: the sheet underneath, the composer floating on top
	   as frosted glass. Layers: grid header and gutter stay below 20, the composer
	   is 20, popovers 40. */
	.main {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		min-height: 0;
	}

	.pane {
		min-height: 0;
		min-width: 0;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}

	.tabs button {
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

	.pane.sheet,
	.pane.side {
		grid-area: 1 / 1;
	}

	.pane.sheet {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
	}

	.pane.side {
		z-index: 20;
		background: var(--surface);
		--composer-bg: transparent;
		--composer-edge: transparent;
	}

	/* Tabbed layout: the Prompt tab covers the sheet, the Sheet tab removes the panel. */
	.pane.side.hide {
		display: none;
	}

	@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
		.pane.side {
			background: var(--glass);
			-webkit-backdrop-filter: blur(6px) saturate(1.4);
			backdrop-filter: blur(6px) saturate(1.4);
			--composer-footer-bg: var(--glass-footer);
		}
	}

	/* Wide layout: no tabs, and the composer becomes a sidebar over the sheet's
	   right edge. Scoped rules outrank Tailwind utilities, so the breakpoint lives here. */
	@media (min-width: 1024px) {
		.tabs {
			display: none;
		}

		.pane.side {
			justify-self: end;
			width: 24rem;
			border-left: 1px solid var(--line);
		}

		.pane.side.hide {
			display: block;
		}

		@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
			.pane.side {
				border-left-color: var(--glass-edge);
				box-shadow:
					inset 1px 0 0 var(--glass-highlight),
					var(--glass-shadow);
			}
		}
	}

	@media (prefers-reduced-transparency: reduce) {
		.pane.side {
			background: var(--surface);
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			--composer-footer-bg: var(--surface-2);
		}
	}
</style>
