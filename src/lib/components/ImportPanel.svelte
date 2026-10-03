<script lang="ts">
	import {
		ArrowRight01Icon,
		CustomerSupportIcon,
		FileUploadIcon,
		Invoice01Icon,
		Note01Icon,
		StarIcon,
		Tag01Icon,
		TextAlignLeftIcon,
		ThumbsUpIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import Icon from '$lib/components/Icon.svelte';
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

	const sampleIcons: Record<string, IconSvgElement> = {
		support: CustomerSupportIcon,
		expenses: Invoice01Icon,
		research: Note01Icon
	};
	// Each sample gets a colour of its own, from the label palette.
	const sampleTones: Record<string, number> = { support: 1, expenses: 2, research: 3 };
	const presetIcons: Record<string, IconSvgElement> = {
		classify: Tag01Icon,
		decide: ThumbsUpIcon,
		summarize: TextAlignLeftIcon,
		score: StarIcon
	};

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
					job: preset.id,
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

<div class="import">
	<label
		class="drop"
		class:on={dragging}
		class:busy
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
		<span class="drop-icon"><Icon icon={FileUploadIcon} size={20} /></span>
		<span class="drop-text">
			<span class="drop-title">
				{busy ? 'Reading the file' : 'Drop a CSV here or click to choose one'}
			</span>
			<span class="drop-sub">The file is read in this browser and never uploaded.</span>
		</span>
		<span class="btn btn-soft choose" aria-hidden="true">Choose file</span>
	</label>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if warnings.length}
		<ul class="warnings">
			{#each warnings as warning (warning)}
				<li>{warning}</li>
			{/each}
		</ul>
	{/if}

	<div>
		<p class="samples-title">Or start from a sample sheet</p>
		<div class="samples">
			{#each SAMPLES as sample (sample.id)}
				{@const preset = presetById(sample.presetId)}
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
					<span class="sample-icon tone-{sampleTones[sample.id] ?? 1}">
						<Icon icon={sampleIcons[sample.id]} size={18} />
					</span>
					<span class="sample-name">{sample.name}</span>
					<span class="sample-blurb">{sample.blurb}</span>
					<span class="sample-foot">
						<span class="sample-preset">
							{#if presetIcons[sample.presetId]}
								<Icon icon={presetIcons[sample.presetId]} size={12} />
							{/if}
							{preset.label}
						</span>
						<span class="sample-rows">{sample.rows} rows</span>
						<Icon icon={ArrowRight01Icon} size={14} strokeWidth={2} class="sample-go" />
					</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.import {
		display: grid;
		gap: 1.25rem;
	}

	.drop {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem 1.1rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-large);
		background: var(--surface);
		cursor: pointer;
		transition:
			border-color var(--dur) ease,
			background-color var(--dur) ease;
	}

	.drop:hover,
	.drop.on {
		border-color: var(--accent);
		background: color-mix(in oklch, var(--accent-soft) 55%, var(--surface));
	}

	.drop:focus-within {
		border-color: var(--accent);
		box-shadow: var(--ring);
	}

	.drop.busy {
		cursor: progress;
	}

	.drop-icon {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		flex-shrink: 0;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.drop-text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.drop-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.drop-sub {
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.choose {
		flex-shrink: 0;
	}

	.error {
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-control);
		border: 1px solid var(--danger-line);
		background: var(--danger-soft);
		font-size: 0.75rem;
		color: var(--danger);
	}

	.warnings {
		display: grid;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.samples-title {
		margin-bottom: 0.6rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.samples {
		display: grid;
		gap: 0.75rem;
	}

	@media (min-width: 720px) {
		.samples {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.sample {
		display: grid;
		justify-items: start;
		align-content: start;
		gap: 0.3rem;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-large);
		background: var(--surface);
		text-align: left;
		box-shadow: var(--elev-1);
		transition:
			border-color var(--dur) ease,
			box-shadow var(--dur) ease,
			transform var(--dur) var(--ease-out);
	}

	.sample:hover:not(:disabled) {
		border-color: var(--line-strong);
		box-shadow: var(--shadow-panel);
		transform: translateY(-1px);
	}

	.sample-icon {
		display: grid;
		place-items: center;
		width: 2.3rem;
		height: 2.3rem;
		margin-bottom: 0.35rem;
		border-radius: 10px;
	}

	.sample-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.sample-blurb {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-3);
	}

	.sample-foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--line);
	}

	.sample-preset {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.sample-rows {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.sample-foot :global(.sample-go) {
		margin-left: auto;
		color: var(--text-3);
		transition:
			transform var(--dur) var(--ease-out),
			color var(--dur) ease;
	}

	.sample:hover:not(:disabled) :global(.sample-go) {
		color: var(--accent-text);
		transform: translateX(2px);
	}

	@media (max-width: 560px) {
		.choose {
			display: none;
		}
	}
</style>
