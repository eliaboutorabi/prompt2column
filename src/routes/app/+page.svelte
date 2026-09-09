<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ArrowLeft, CheckCircle, DownloadSimple, Warning } from 'phosphor-svelte';
	import Composer from '$lib/components/Composer.svelte';
	import DataGrid from '$lib/components/DataGrid.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { downloadCsv, exportFilename } from '$lib/core/csv';
	import { Workspace } from '$lib/state/workspace.svelte';
	import { models } from '$lib/state/models.svelte';
	import { session } from '$lib/state/session.svelte';
	import type { Column } from '$lib/core/types';

	const ws = new Workspace();
	let composer = $state<Composer | null>(null);
	let view = $state<'sheet' | 'prompt'>('sheet');
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

	function exportSheet() {
		if (!ws.project) return;
		downloadCsv(exportFilename(ws.project.name, ws.project.fileName), ws.exportCsv());
	}

	function insert(column: Column) {
		view = 'prompt';
		composer?.insertColumn(column);
	}

	const generatedCount = $derived(ws.columns.filter((column) => column.generated).length);
</script>

<svelte:head>
	<title>{ws.project ? `${ws.project.name} | prompt2column` : 'prompt2column'}</title>
</svelte:head>

<div class="grid h-[100dvh] grid-rows-[3.25rem_1fr]">
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
			<button class="btn btn-outline" onclick={exportSheet} disabled={!ws.project}>
				<DownloadSimple size={15} /> Export CSV
			</button>
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
				<div class={['pane', view !== 'sheet' && 'hide']}>
					<DataGrid {ws} onInsert={insert} />
				</div>
				<div class={['pane', view !== 'prompt' && 'hide']}>
					<Composer bind:this={composer} {ws} />
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.name {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0.2rem 0.4rem;
		font-size: 0.875rem;
		font-weight: 500;
		min-width: 6rem;
		max-width: 18rem;
	}

	.name:hover {
		border-color: var(--line);
	}

	.name:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--surface);
	}

	.workspace {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
	}

	.main {
		display: grid;
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

	.pane.hide {
		display: none;
	}

	@media (min-width: 1024px) {
		.main {
			grid-template-columns: minmax(0, 1fr) 24rem;
		}

		/* Scoped rules outrank Tailwind utilities, so the breakpoint lives here. */
		.tabs {
			display: none;
		}

		.pane.hide {
			display: block;
		}
	}
</style>
