<script lang="ts">
	import { ArrowsClockwise, Eye, Pause, Play, Stop, WarningCircle } from 'phosphor-svelte';
	import PromptEditor from './PromptEditor.svelte';
	import OutputEditor from './OutputEditor.svelte';
	import ScopeEditor from './ScopeEditor.svelte';
	import PreviewDialog from './PreviewDialog.svelte';
	import { PRESETS, presetById } from '$lib/core/presets';
	import { formatModelSize } from '$lib/core/ollama';
	import { models } from '$lib/state/models.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';
	import type { Column } from '$lib/core/types';

	interface Props {
		ws: Workspace;
	}

	let { ws }: Props = $props();

	let editor = $state<PromptEditor | null>(null);
	let showPreview = $state(false);
	let activePreset = $state('');

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	const matchCount = $derived(ws.scopedRows.length);
	const percent = $derived(
		ws.runTotal ? Math.round(((ws.runDone + ws.runFailed) / ws.runTotal) * 100) : 0
	);
	const perRowMs = $derived(
		ws.runDone + ws.runFailed > 0 ? ws.runElapsedMs / (ws.runDone + ws.runFailed) : 0
	);
	const remainingMs = $derived(perRowMs * Math.max(0, ws.runTotal - ws.runDone - ws.runFailed));

	export function insertColumn(column: Column) {
		void editor?.insertColumn(column);
	}

	function applyPreset(id: string) {
		const preset = presetById(id);
		activePreset = id;
		config.output = { ...preset.output };
		config.instructions = preset.instructions;
		config.template = preset.template(ws.columns, ws.rows);
		if (!config.targetColumnName.trim() || isPresetName(config.targetColumnName)) {
			config.targetColumnName = uniqueName(preset.columnName);
		}
		ws.touch();
	}

	function isPresetName(name: string): boolean {
		return PRESETS.some((preset) => preset.columnName === name.replace(/ \d+$/, ''));
	}

	function uniqueName(base: string): string {
		const taken = new Set(ws.columns.map((column) => column.name.toLowerCase()));
		if (!taken.has(base.toLowerCase())) return base;
		let n = 2;
		while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
		return `${base} ${n}`;
	}

	function formatDuration(ms: number): string {
		if (!Number.isFinite(ms) || ms <= 0) return '0s';
		const seconds = Math.round(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
	}
</script>

<aside class="composer">
	<div class="scroll">
		<section class="block">
			<h2 class="text-sm font-semibold tracking-tight text-ink">Add a column</h2>
			<p class="mt-0.5 text-xs text-ink-3">
				Write one prompt. It runs once per row and fills the new column.
			</p>
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each PRESETS as preset (preset.id)}
					<button
						type="button"
						class="preset"
						class:on={activePreset === preset.id}
						title={preset.blurb}
						disabled={busy}
						onclick={() => applyPreset(preset.id)}
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</section>

		<section class="block">
			<label class="label" for="target-name">Column name</label>
			<input
				id="target-name"
				class="field"
				placeholder="Sentiment"
				bind:value={config.targetColumnName}
				disabled={busy}
				oninput={() => ws.touch()}
			/>
			{#if ws.targetColumn && !ws.targetColumn.generated}
				<p class="mt-1.5 text-xs text-ink-3">
					This name matches an imported column. The run will write over it.
				</p>
			{/if}
		</section>

		<section class="block">
			<label class="label" for="prompt-editor">Prompt</label>
			<PromptEditor
				bind:this={editor}
				bind:value={config.template}
				columns={ws.columns}
				disabled={busy}
				placeholder={'Summarize this row in one sentence.\n\nNotes: {{Raw notes}}'}
			/>
			<div class="mt-2 flex flex-wrap items-center gap-1">
				<span class="mr-1 text-xs text-ink-3">Insert:</span>
				{#each ws.columns.slice(0, 12) as column (column.id)}
					<button
						type="button"
						class="colchip"
						disabled={busy}
						onclick={() => insertColumn(column)}
					>
						{column.name}
					</button>
				{/each}
			</div>
			{#if issues.unknown.length}
				<p class="warn" role="alert">
					<WarningCircle size={14} weight="fill" />
					<span>
						No column called {issues.unknown
							.map((name) => (name === '' ? 'an empty reference' : `"${name}"`))
							.join(', ')}.
					</span>
				</p>
			{:else if config.template.trim() !== '' && issues.hasNoTokens}
				<p class="hint">
					This prompt has no column reference, so every row gets the same answer. Type two braces or
					click a column name above.
				</p>
			{/if}
		</section>

		<section class="block">
			<OutputEditor bind:spec={config.output} disabled={busy} />
		</section>

		<section class="block">
			<label class="label" for="instructions">Extra rules</label>
			<textarea
				id="instructions"
				class="field"
				rows="2"
				placeholder="Judge only what the text says."
				bind:value={config.instructions}
				disabled={busy}
				oninput={() => ws.touch()}></textarea>
		</section>

		<section class="block">
			<ScopeEditor
				bind:scope={config.scope}
				bind:overwrite={config.overwrite}
				rowCount={ws.rows.length}
				selectedCount={ws.selected.size}
				{matchCount}
				hasTarget={ws.targetColumn !== null}
				disabled={busy}
			/>
		</section>

		<section class="block">
			<div class="flex items-end justify-between gap-2">
				<label class="label mb-0" for="model">Model</label>
				<button
					type="button"
					class="btn btn-ghost h-6 px-1.5 text-xs"
					onclick={() => models.scan()}
					disabled={models.loading}
				>
					<ArrowsClockwise size={13} class={models.loading ? 'spin' : ''} />
					Rescan
				</button>
			</div>
			<select
				id="model"
				class="field mt-1"
				bind:value={config.model}
				disabled={busy || !models.models.length}
				onchange={() => ws.touch()}
			>
				{#if !models.models.length}
					<option value="">No models found</option>
				{/if}
				{#each models.models as model (model.name)}
					<option value={model.name}>
						{model.name}{model.size ? ` (${formatModelSize(model.size)})` : ''}
					</option>
				{/each}
			</select>
			{#if models.error}
				<p class="warn" role="alert">
					<WarningCircle size={14} weight="fill" />
					<span>{models.error}</span>
				</p>
			{/if}

			<details class="advanced">
				<summary>Advanced</summary>
				<div class="grid gap-3 pt-3">
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="label" for="concurrency">Rows at once</label>
							<input
								id="concurrency"
								type="number"
								min="1"
								max="8"
								class="field"
								bind:value={config.concurrency}
								disabled={busy}
							/>
						</div>
						<div>
							<label class="label" for="temperature">Temperature</label>
							<input
								id="temperature"
								type="number"
								min="0"
								max="1"
								step="0.1"
								class="field"
								bind:value={config.temperature}
								disabled={busy}
							/>
						</div>
					</div>
					<div>
						<label class="label" for="host">Ollama address</label>
						<input
							id="host"
							class="field"
							value={models.host}
							disabled={busy}
							onchange={(event) => {
								models.setHost(event.currentTarget.value);
								void models.scan();
							}}
						/>
					</div>
					<label class="flex items-center gap-2 text-xs text-ink-2">
						<input
							type="checkbox"
							class="size-3.5 accent-accent"
							bind:checked={config.think}
							disabled={busy}
						/>
						Let thinking models reason first (slower)
					</label>
				</div>
			</details>
		</section>
	</div>

	<footer class="runbar">
		{#if ws.isBusy || ws.runTotal > 0}
			<div class="progress" role="status" aria-live="polite">
				<div class="track">
					<div class="fill" style="width: {percent}%"></div>
				</div>
				<div class="mt-1.5 flex items-center justify-between font-mono text-xs text-ink-2">
					<span>{ws.runDone + ws.runFailed} / {ws.runTotal} rows</span>
					<span>
						{#if ws.isBusy}
							{formatDuration(remainingMs)} left
						{:else}
							{formatDuration(ws.runElapsedMs)} total
						{/if}
					</span>
				</div>
			</div>
		{/if}

		{#if ws.runFailed > 0 && !ws.isBusy}
			<button
				type="button"
				class="btn btn-outline w-full"
				onclick={() => ws.retryFailed(models.host)}
			>
				Retry {ws.runFailed} failed {ws.runFailed === 1 ? 'row' : 'rows'}
			</button>
		{/if}

		<div class="flex gap-2">
			<button
				type="button"
				class="btn btn-outline"
				onclick={() => (showPreview = true)}
				disabled={!config.template.trim() || issues.unknown.length > 0}
			>
				<Eye size={15} /> Preview
			</button>

			{#if ws.runState === 'running'}
				<button type="button" class="btn btn-outline flex-1" onclick={() => ws.pause()}>
					<Pause size={15} weight="fill" /> Pause
				</button>
				<button type="button" class="btn btn-outline" onclick={() => ws.stop()}>
					<Stop size={15} weight="fill" /> Stop
				</button>
			{:else if ws.runState === 'paused'}
				<button type="button" class="btn btn-primary flex-1" onclick={() => ws.resume()}>
					<Play size={15} weight="fill" /> Resume
				</button>
				<button type="button" class="btn btn-outline" onclick={() => ws.stop()}>
					<Stop size={15} weight="fill" /> Stop
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-primary flex-1"
					disabled={!ws.canRun}
					onclick={() => ws.run(models.host)}
				>
					<Play size={15} weight="fill" />
					Run on {matchCount}
					{matchCount === 1 ? 'row' : 'rows'}
				</button>
			{/if}
		</div>

		{#if ws.runMessage && !ws.isBusy}
			<p class="text-xs text-ink-2">{ws.runMessage}</p>
		{/if}
	</footer>
</aside>

{#if showPreview}
	<PreviewDialog {ws} host={models.host} onClose={() => (showPreview = false)} />
{/if}

<style>
	.composer {
		display: grid;
		grid-template-rows: 1fr auto;
		height: 100%;
		min-height: 0;
		background: var(--surface);
		border-left: 1px solid var(--line);
	}

	.scroll {
		overflow-y: auto;
		min-height: 0;
	}

	.block {
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	.preset {
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		padding: 0.2rem 0.65rem;
		font-size: 0.75rem;
		color: var(--text-2);
		transition:
			background-color 0.14s ease,
			color 0.14s ease;
	}

	.preset:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.preset.on {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent-text);
		font-weight: 500;
	}

	.colchip {
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		padding: 0.1rem 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-2);
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.colchip:hover:not(:disabled) {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent-text);
	}

	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.5rem;
		color: var(--danger);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.hint {
		margin-top: 0.5rem;
		color: var(--text-3);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.advanced {
		margin-top: 0.75rem;
		border-top: 1px solid var(--line);
		padding-top: 0.6rem;
	}

	.advanced summary {
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--text-2);
		list-style: none;
	}

	.advanced summary::-webkit-details-marker {
		display: none;
	}

	.advanced summary::before {
		content: '+ ';
		color: var(--text-3);
	}

	.advanced[open] summary::before {
		content: '- ';
	}

	.runbar {
		display: grid;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border-top: 1px solid var(--line);
		background: var(--surface-2);
	}

	.track {
		height: 5px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.2s ease;
	}
</style>
