<script lang="ts">
	import {
		Add01Icon,
		AiChipIcon,
		AiMagicIcon,
		AlertCircleIcon,
		ArrowDown01Icon,
		CheckmarkCircle02Icon,
		CommandLineIcon,
		Copy01Icon,
		PauseIcon,
		PlayIcon,
		Plug01Icon,
		QuillWrite02Icon,
		RefreshIcon,
		Settings02Icon,
		StarIcon,
		StopIcon,
		Tag01Icon,
		TextAlignLeftIcon,
		ThumbsUpIcon,
		Tick02Icon,
		ViewIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PromptEditor from './PromptEditor.svelte';
	import { autogrow } from '$lib/actions/autogrow';
	import Select from './Select.svelte';
	import OutputEditor from './OutputEditor.svelte';
	import ScopeEditor from './ScopeEditor.svelte';
	import PreviewDialog from './PreviewDialog.svelte';
	import { kindIcons } from './kinds';
	import { PRESETS, presetById } from '$lib/core/presets';
	import { detectKind } from '$lib/core/columns';
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
	let copiedCommand = $state('');
	let notice = $state<HTMLDivElement | null>(null);

	function showNotice() {
		notice?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const presetIcons: Record<string, IconSvgElement> = {
		classify: Tag01Icon,
		decide: ThumbsUpIcon,
		summarize: TextAlignLeftIcon,
		score: StarIcon,
		blank: QuillWrite02Icon
	};

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	const matchCount = $derived(ws.scopedRows.length);
	const finished = $derived(ws.runDone + ws.runFailed);
	const percent = $derived(ws.runTotal ? Math.round((finished / ws.runTotal) * 100) : 0);
	const perRowMs = $derived(finished > 0 ? ws.runElapsedMs / finished : 0);
	const remainingMs = $derived(perRowMs * Math.max(0, ws.runTotal - finished));
	const columnKinds = $derived(ws.columns.map((column) => detectKind(column, ws.rows)));
	const modelKnown = $derived(models.models.some((model) => model.name === config.model));
	// What the model list can say at a glance: size, and whether it reasons or sees images.
	const modelOptions = $derived(
		models.models.map((model) => ({
			value: model.name,
			label: model.name,
			hint: formatModelSize(model.size),
			badges: model.capabilities.filter((capability) => ['thinking', 'vision'].includes(capability))
		}))
	);

	/** The one thing standing between the user and a run, said plainly. */
	const blocker = $derived.by(() => {
		if (busy) return '';
		if (models.loading && !models.checkedAt) return 'Looking for Ollama';
		if (models.problem === 'offline') return 'Start Ollama to run';
		if (models.problem === 'empty') return 'Pull a model to run';
		if (!config.targetColumnName.trim()) return 'Name the new column to run';
		if (!config.template.trim()) return 'Write a prompt to run';
		if (issues.unknown.length) return 'Fix the column references in the prompt';
		if (!config.model || !modelKnown) return 'Choose a model to run';
		if (!matchCount) return 'No rows match the rows to run';
		return '';
	});
	const runnable = $derived(!blocker && ws.canRun);

	export function insertColumn(column: Column) {
		void editor?.insertColumn(column);
	}

	/** Also reached with ⌘↵ / Ctrl ↵ from anywhere in the workspace. */
	export function run() {
		if (runnable) void ws.run(models.host);
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

	async function copyCommand(command: string) {
		try {
			await navigator.clipboard.writeText(command);
			copiedCommand = command;
			setTimeout(() => (copiedCommand = ''), 1600);
		} catch {
			copiedCommand = '';
		}
	}
</script>

{#snippet command(text: string)}
	<span class="command">
		<Icon icon={CommandLineIcon} size={14} class="command-icon" />
		<code>{text}</code>
		<button
			type="button"
			class="command-copy"
			title="Copy the command"
			aria-label={copiedCommand === text ? 'Command copied' : `Copy ${text}`}
			onclick={() => copyCommand(text)}
		>
			<Icon icon={copiedCommand === text ? Tick02Icon : Copy01Icon} size={13} />
		</button>
	</span>
{/snippet}

<aside class="composer">
	<div class="scroll">
		<header class="intro">
			<div class="title-row">
				<span class="badge"><Icon icon={AiMagicIcon} size={17} /></span>
				<div>
					<h2 class="title">Add a column</h2>
					<p class="subtitle">One prompt, run once on every row.</p>
				</div>
			</div>
			<div class="presets" role="group" aria-label="Start from a preset">
				{#each PRESETS as preset (preset.id)}
					<button
						type="button"
						class="preset"
						class:on={activePreset === preset.id}
						title={preset.blurb}
						disabled={busy}
						onclick={() => applyPreset(preset.id)}
					>
						<Icon icon={presetIcons[preset.id]} size={14} />
						{preset.label}
					</button>
				{/each}
			</div>
		</header>

		<!-- Nothing can run without Ollama, so its problem comes first, not under the model list. -->
		{#if models.problem}
			<div class="notice" bind:this={notice}>
				<div class="callout" role="alert">
					<span class="callout-icon">
						<Icon icon={models.problem === 'offline' ? Plug01Icon : AlertCircleIcon} size={16} />
					</span>
					<div class="callout-body">
						{#if models.problem === 'offline'}
							<p class="callout-title">Ollama isn't reachable</p>
							<p class="callout-text">
								Nothing answered at {models.host}. Start it in a terminal, then try again.
							</p>
							{@render command('ollama serve')}
						{:else if models.problem === 'empty'}
							<p class="callout-title">No models yet</p>
							<p class="callout-text">Ollama is running but has nothing to run. Pull a model:</p>
							{@render command('ollama pull llama3.2')}
						{:else}
							<p class="callout-title">Couldn't list models</p>
							<p class="callout-text">{models.error}</p>
						{/if}
						<button
							type="button"
							class="btn btn-outline retry"
							onclick={() => models.scan()}
							disabled={models.loading}
						>
							<Icon icon={RefreshIcon} size={14} class={models.loading ? 'spin' : ''} />
							Try again
						</button>
					</div>
				</div>
			</div>
		{/if}

		<section class="group">
			<label class="label" for="target-name">Column name</label>
			<input
				id="target-name"
				class="field name-input"
				placeholder="Sentiment"
				bind:value={config.targetColumnName}
				disabled={busy}
				oninput={() => ws.touch()}
			/>
			{#if ws.targetColumn && !ws.targetColumn.generated}
				<p class="hint">This name matches an imported column. The run will write over it.</p>
			{/if}
		</section>

		<section class="group">
			<div class="group-head">
				<label class="label" for="prompt-editor">Prompt</label>
				<button
					type="button"
					class="head-action"
					disabled={busy}
					onclick={() => editor?.openPalette()}
					title="Insert a column reference at the cursor (or type {'{{'} or @)"
				>
					<Icon icon={Add01Icon} size={13} strokeWidth={2} />
					Insert column
				</button>
			</div>
			<PromptEditor
				bind:this={editor}
				bind:value={config.template}
				columns={ws.columns}
				disabled={busy}
				placeholder={'Summarize this row in one sentence.\n\nNotes: {{Raw notes}}'}
			/>
			<div class="columns" role="group" aria-label="Click a column to insert it">
				{#each ws.columns.slice(0, 16) as column, index (column.id)}
					<button
						type="button"
						class="colchip"
						class:generated={column.generated}
						disabled={busy}
						onclick={() => insertColumn(column)}
					>
						<Icon icon={kindIcons[columnKinds[index] ?? 'text']} size={12} />
						{column.name}
					</button>
				{/each}
			</div>
			{#if issues.unknown.length}
				<p class="warn" role="alert">
					<Icon icon={AlertCircleIcon} size={14} />
					<span>
						No column called {issues.unknown
							.map((name) => (name === '' ? 'an empty reference' : `"${name}"`))
							.join(', ')}.
					</span>
				</p>
			{:else if config.template.trim() !== '' && issues.hasNoTokens}
				<p class="hint">
					This prompt has no column reference, so every row gets the same answer. Insert a column
					above.
				</p>
			{/if}
		</section>

		<section class="group">
			<OutputEditor bind:spec={config.output} disabled={busy} />
		</section>

		<section class="group">
			<div class="group-head">
				<label class="label" for="instructions">Extra rules</label>
				<span class="optional">Optional</span>
			</div>
			<textarea
				id="instructions"
				class="field rules"
				rows="2"
				placeholder="Judge only what the text says."
				bind:value={config.instructions}
				use:autogrow={config.instructions}
				disabled={busy}
				oninput={() => ws.touch()}></textarea>
		</section>

		<section class="group">
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

		<section class="group">
			<div class="group-head">
				<label class="label" for="model">Model</label>
				<button
					type="button"
					class="head-action"
					onclick={() => models.scan()}
					disabled={models.loading}
				>
					<Icon icon={RefreshIcon} size={13} class={models.loading ? 'spin' : ''} />
					Rescan
				</button>
			</div>
			<Select
				icon={AiChipIcon}
				id="model"
				block
				options={modelOptions}
				value={modelKnown ? config.model : ''}
				placeholder={models.models.length ? 'Choose a model' : 'No models found'}
				disabled={busy || !models.models.length}
				onchange={(value) => {
					config.model = value;
					ws.touch();
				}}
			/>
			{#if models.problem}
				<button type="button" class="warn link" onclick={showNotice}>
					<Icon icon={AlertCircleIcon} size={14} />
					{models.problem === 'offline' ? "Ollama isn't reachable." : 'No models to choose from.'}
					See how to fix it.
				</button>
			{/if}

			<details class="advanced">
				<summary>
					<Icon icon={Settings02Icon} size={14} />
					Advanced
					<Icon icon={ArrowDown01Icon} size={12} strokeWidth={2} class="chev" />
				</summary>
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
					<label class="check">
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
			<div
				class={['progress', ws.runState === 'running' && 'live']}
				role="status"
				aria-live="polite"
			>
				<div class="progress-head">
					<span class="state">
						{#if ws.runState === 'running'}
							<span class="pulse" aria-hidden="true"></span> Running
						{:else if ws.runState === 'paused'}
							<Icon icon={PauseIcon} size={13} /> Paused
						{:else if ws.runState === 'stopped'}
							<Icon icon={StopIcon} size={13} /> Stopped
						{:else}
							<Icon icon={CheckmarkCircle02Icon} size={14} class="done-icon" /> Done
						{/if}
					</span>
					<span class="count">{finished} / {ws.runTotal} rows</span>
				</div>
				<div class="track">
					<div class="fill" style:width="{percent}%"></div>
				</div>
				<div class="progress-foot">
					<span class={ws.runFailed ? 'failed' : ''}>
						{#if ws.runFailed}
							{ws.runFailed} failed
						{:else if ws.isBusy}
							{ws.runDone} written
						{:else}
							All written
						{/if}
					</span>
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
				<Icon icon={RefreshIcon} size={15} />
				Retry {ws.runFailed} failed {ws.runFailed === 1 ? 'row' : 'rows'}
			</button>
		{/if}

		{#if blocker && models.problem}
			<button type="button" class="blocker link" onclick={showNotice}>{blocker}</button>
		{:else if blocker}
			<p class="blocker">{blocker}</p>
		{/if}

		<div class="actions">
			<button
				type="button"
				class="btn btn-outline"
				onclick={() => (showPreview = true)}
				disabled={!config.template.trim() || issues.unknown.length > 0}
			>
				<Icon icon={ViewIcon} size={15} /> Preview
			</button>

			{#if ws.runState === 'running'}
				<button type="button" class="btn btn-outline grow" onclick={() => ws.pause()}>
					<Icon icon={PauseIcon} size={15} /> Pause
				</button>
				<button type="button" class="btn btn-outline" onclick={() => ws.stop()}>
					<Icon icon={StopIcon} size={15} /> Stop
				</button>
			{:else if ws.runState === 'paused'}
				<button type="button" class="btn btn-primary grow" onclick={() => ws.resume()}>
					<Icon icon={PlayIcon} size={15} /> Resume
				</button>
				<button type="button" class="btn btn-outline" onclick={() => ws.stop()}>
					<Icon icon={StopIcon} size={15} /> Stop
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-primary run grow"
					disabled={!runnable}
					onclick={run}
					title={isMac ? 'Run (⌘ Return)' : 'Run (Ctrl Enter)'}
				>
					<Icon icon={PlayIcon} size={15} />
					Run on {matchCount}
					{matchCount === 1 ? 'row' : 'rows'}
					<kbd class="shortcut" aria-hidden="true">{isMac ? '⌘↵' : 'Ctrl ↵'}</kbd>
				</button>
			{/if}
		</div>

		{#if ws.runMessage && !ws.isBusy}
			<p class="message">{ws.runMessage}</p>
		{/if}
	</footer>
</aside>

{#if showPreview}
	<PreviewDialog {ws} host={models.host} onClose={() => (showPreview = false)} />
{/if}

<style>
	/* Solid by default. The workspace swaps these for frosted glass when the
	   composer floats over the sheet. */
	.composer {
		display: grid;
		grid-template-rows: 1fr auto;
		height: 100%;
		min-height: 0;
		background: var(--composer-bg, var(--surface));
		border-left: 1px solid var(--composer-edge, var(--line));
	}

	.scroll {
		overflow-y: auto;
		min-height: 0;
	}

	.intro {
		padding: 1.1rem 1.1rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		flex-shrink: 0;
		border-radius: 10px;
		background: var(--accent-soft);
		color: var(--accent-text);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
	}

	.title {
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--text);
	}

	.subtitle {
		margin-top: 0.05rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.9rem;
	}

	.preset {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 1.8rem;
		padding: 0 0.7rem 0 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		font-size: 0.75rem;
		color: var(--text-2);
		box-shadow: var(--elev-1);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease,
			border-color var(--dur-fast) ease;
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

	.group {
		padding: 1rem 1.1rem;
		border-bottom: 1px solid color-mix(in oklch, var(--line) 80%, transparent);
	}

	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.group-head .label {
		margin-bottom: 0;
	}

	.head-action {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.5rem;
		padding: 0 0.45rem;
		border-radius: 6px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-2);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.head-action:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.head-action:disabled {
		opacity: 0.5;
	}

	.optional {
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.name-input {
		font-weight: 500;
	}

	.columns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.55rem;
	}

	.colchip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		max-width: 11rem;
		height: 1.5rem;
		padding: 0 0.5rem 0 0.4rem;
		border-radius: 6px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		font-size: 0.6875rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			background-color var(--dur-fast) ease,
			border-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.colchip :global(.hi) {
		color: var(--text-3);
	}

	.colchip.generated :global(.hi) {
		color: var(--accent-text);
	}

	.colchip:hover:not(:disabled) {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent-text);
	}

	.colchip:hover:not(:disabled) :global(.hi) {
		color: var(--accent-text);
	}

	.rules {
		max-height: 12rem;
	}

	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.55rem;
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

	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-2);
	}

	/* Something to do, not just something wrong: what happened and the fix. */
	.notice {
		padding: 0.9rem 1.1rem 0;
	}

	.callout {
		display: flex;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: var(--radius-panel);
		background: color-mix(in oklch, var(--danger-soft) 70%, var(--surface));
		border: 1px solid color-mix(in oklch, var(--danger-line) 60%, transparent);
	}

	.callout-icon {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		flex-shrink: 0;
		border-radius: 8px;
		background: var(--surface);
		color: var(--danger);
		box-shadow: var(--elev-1);
	}

	.callout-body {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
		justify-items: start;
	}

	.callout-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}

	.callout-text {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-2);
		overflow-wrap: anywhere;
	}

	.command {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		max-width: 100%;
		margin-top: 0.15rem;
		padding: 0.3rem 0.3rem 0.3rem 0.55rem;
		border-radius: var(--radius-control);
		background: var(--surface);
		border: 1px solid var(--line-strong);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text);
	}

	.command :global(.command-icon) {
		color: var(--text-3);
	}

	.command-copy {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 6px;
		color: var(--text-3);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.command-copy:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.retry {
		height: 1.75rem;
		margin-top: 0.25rem;
		font-size: 0.75rem;
	}

	.advanced {
		margin-top: 0.85rem;
		border-top: 1px solid var(--line);
		padding-top: 0.7rem;
	}

	.advanced summary {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--text-2);
		list-style: none;
	}

	.advanced summary:hover {
		color: var(--text);
	}

	.advanced summary::-webkit-details-marker {
		display: none;
	}

	.advanced summary :global(.chev) {
		margin-left: auto;
		color: var(--text-3);
		transition: transform var(--dur) var(--ease-out);
	}

	.advanced[open] summary :global(.chev) {
		transform: rotate(180deg);
	}

	.runbar {
		display: grid;
		gap: 0.65rem;
		padding: 0.85rem 1.1rem 1rem;
		border-top: 1px solid var(--line);
		background: var(--composer-footer-bg, var(--surface-2));
	}

	.progress {
		display: grid;
		gap: 0.45rem;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius-panel);
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: var(--elev-1);
	}

	.progress-head,
	.progress-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
	}

	.state :global(.done-icon) {
		color: var(--accent-text);
	}

	.pulse {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--accent);
		box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 60%, transparent);
		animation: ping 1.4s var(--ease-out) infinite;
	}

	@keyframes ping {
		70% {
			box-shadow: 0 0 0 6px color-mix(in oklch, var(--accent) 0%, transparent);
		}
		100% {
			box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 0%, transparent);
		}
	}

	.count,
	.progress-foot {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.count {
		color: var(--text-2);
	}

	.progress-foot .failed {
		color: var(--danger);
	}

	.track {
		position: relative;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		transition: width 0.35s var(--ease-out);
	}

	/* A light sweep along the bar while rows are being written. */
	.live .fill {
		background-image: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in oklch, white 45%, transparent) 50%,
			transparent 100%
		);
		background-size: 60% 100%;
		background-repeat: no-repeat;
		animation: sweep 1.4s linear infinite;
	}

	@keyframes sweep {
		from {
			background-position: -60% 0;
		}
		to {
			background-position: 160% 0;
		}
	}

	.blocker {
		font-size: 0.75rem;
		color: var(--text-3);
		text-align: center;
	}

	.link {
		cursor: pointer;
		text-align: left;
	}

	.blocker.link {
		justify-self: center;
		text-align: center;
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
		text-underline-offset: 3px;
	}

	.link:hover {
		color: var(--text);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.actions :global(.btn) {
		height: 2.35rem;
	}

	.grow {
		flex: 1;
	}

	.shortcut {
		margin-left: 0.2rem;
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
		background: color-mix(in oklch, var(--accent-ink) 12%, transparent);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 500;
		color: color-mix(in oklch, var(--accent-ink) 75%, transparent);
	}

	.message {
		font-size: 0.75rem;
		color: var(--text-2);
	}
</style>
