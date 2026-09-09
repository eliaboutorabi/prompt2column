<script lang="ts">
	import { FileCsv, UploadSimple } from 'phosphor-svelte';
	import { parseCsv } from '$lib/core/csv';
	import { SAMPLES, loadSample } from '$lib/core/samples';
	import { presetById } from '$lib/core/presets';
	import { session } from '$lib/state/session.svelte';
	import { putProject } from '$lib/core/db';
	import type { Project } from '$lib/core/types';

	interface Props {
		onCreated: (project: Project) => void;
	}

	let { onCreated }: Props = $props();

	let dragging = $state(false);
	let busy = $state(false);
	let error = $state('');
	let warnings = $state<string[]>([]);

	async function ingest(text: string, name: string, presetId?: string) {
		busy = true;
		error = '';
		warnings = [];
		try {
			const table = parseCsv(text);
			if (!table.columns.length) throw new Error('That file has no header row.');
			if (!table.rows.length) throw new Error('That file has a header but no data rows.');
			warnings = table.warnings;
			const project = await session.createProject(prettyName(name), table, name);
			if (presetId) {
				const preset = presetById(presetId);
				project.config = {
					...project.config,
					output: { ...preset.output },
					instructions: preset.instructions,
					template: preset.template(table.columns, table.rows),
					targetColumnName: preset.columnName
				};
				await putProject(project);
			}
			onCreated(project);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}

	function prettyName(fileName: string): string {
		return fileName
			.replace(/\.[a-z]+$/i, '')
			.replace(/[-_]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/^./, (char) => char.toUpperCase());
	}

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
			error = 'CSV files only for now. Excel support is next.';
			return;
		}
		await ingest(await file.text(), file.name);
	}
</script>

<div class="grid gap-3">
	<label
		class="drop"
		class:on={dragging}
		ondragover={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(event) => {
			event.preventDefault();
			dragging = false;
			void handleFiles(event.dataTransfer?.files ?? null);
		}}
	>
		<input
			type="file"
			accept=".csv,text/csv"
			class="sr-only"
			disabled={busy}
			onchange={(event) => void handleFiles(event.currentTarget.files)}
		/>
		<UploadSimple size={22} weight="regular" class="text-ink-3" />
		<span class="text-sm font-medium text-ink">
			{busy ? 'Reading the file' : 'Drop a CSV here or click to choose one'}
		</span>
		<span class="text-xs text-ink-3">The file is read in this browser and never uploaded.</span>
	</label>

	{#if error}
		<p
			class="rounded-[var(--radius-control)] border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger"
			role="alert"
		>
			{error}
		</p>
	{/if}

	{#if warnings.length}
		<ul class="grid gap-1 text-xs text-ink-3">
			{#each warnings as warning (warning)}
				<li>{warning}</li>
			{/each}
		</ul>
	{/if}

	<div>
		<p class="mb-2 text-xs text-ink-2">Or start from a sample sheet</p>
		<div class="grid gap-2 sm:grid-cols-3">
			{#each SAMPLES as sample (sample.id)}
				<button
					type="button"
					class="sample"
					disabled={busy}
					onclick={async () => {
						try {
							const text = await loadSample(sample);
							await ingest(text, sample.file, sample.presetId);
						} catch (cause) {
							error = cause instanceof Error ? cause.message : String(cause);
						}
					}}
				>
					<FileCsv size={17} weight="regular" class="text-ink-3" />
					<span class="text-[0.8125rem] font-medium text-ink">{sample.name}</span>
					<span class="text-xs leading-snug text-ink-3">{sample.blurb}</span>
					<span class="font-mono text-[0.6875rem] text-ink-3">{sample.rows} rows</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.drop {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		padding: 2rem 1rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-panel);
		background: var(--surface);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 0.14s ease,
			background-color 0.14s ease;
	}

	.drop:hover,
	.drop.on {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.sample {
		display: grid;
		justify-items: start;
		gap: 0.2rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
		text-align: left;
		transition:
			border-color 0.14s ease,
			background-color 0.14s ease;
	}

	.sample:hover:not(:disabled) {
		border-color: var(--accent-line);
		background: var(--accent-soft);
	}
</style>
