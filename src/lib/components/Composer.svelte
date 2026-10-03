<script lang="ts">
	import {
		Add01Icon,
		AlertCircleIcon,
		CommandLineIcon,
		Copy01Icon,
		Plug01Icon,
		QuillWrite02Icon,
		RefreshIcon,
		StarIcon,
		Tag01Icon,
		TextAlignLeftIcon,
		ThumbsUpIcon,
		Tick02Icon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import Brand from '$lib/components/Brand.svelte';
	import PromptEditor from './PromptEditor.svelte';
	import { autogrow } from '$lib/actions/autogrow';
	import OutputEditor from './OutputEditor.svelte';
	import ScopeEditor from './ScopeEditor.svelte';
	import { kindIcons } from './kinds';
	import { PRESETS, presetById } from '$lib/core/presets';
	import { detectKind } from '$lib/core/columns';
	import { models } from '$lib/state/models.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';
	import type { Column } from '$lib/core/types';

	interface Props {
		ws: Workspace;
	}

	let { ws }: Props = $props();

	let editor = $state<PromptEditor | null>(null);
	let activePreset = $state('');
	let copiedCommand = $state('');
	let notice = $state<HTMLDivElement | null>(null);

	/** Reached from the status bar when Ollama is what's stopping a run. */
	export function showNotice() {
		notice?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const presetIcons: Record<string, IconSvgElement> = {
		classify: Tag01Icon,
		decide: ThumbsUpIcon,
		summarize: TextAlignLeftIcon,
		score: StarIcon,
		blank: QuillWrite02Icon
	};

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	const matchCount = $derived(ws.scopedRows.length);
	const columnKinds = $derived(ws.columns.map((column) => detectKind(column, ws.rows)));

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
			use:tooltip={copiedCommand === text ? 'Copied' : 'Copy the command'}
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
				<Brand markOnly size={24} />
				<h2 class="title">Add a column</h2>
				<span class="subtitle">One prompt, run on every row</span>
			</div>
			<div class="presets" role="group" aria-label="Start from a preset">
				{#each PRESETS as preset (preset.id)}
					<button
						type="button"
						class="preset"
						class:on={activePreset === preset.id}
						use:tooltip={preset.blurb}
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
			<div class="name-row">
				<label class="label" for="target-name">Column name</label>
				<input
					id="target-name"
					class="field name-input"
					placeholder="Sentiment"
					bind:value={config.targetColumnName}
					disabled={busy}
					oninput={() => ws.touch()}
				/>
			</div>
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
					use:tooltip={{ text: 'Insert a column at the cursor, or type', kbd: '{{' }}
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
				rows="1"
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
	</div>
</aside>

<style>
	/* Solid by default. The workspace swaps these for frosted glass when the
	   composer floats over the sheet. */
	.composer {
		display: grid;
		grid-template-rows: minmax(0, 1fr);
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
		padding: 0.85rem 1rem 0.8rem;
		border-bottom: 1px solid var(--line);
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		min-width: 0;
	}

	.title-row :global(:first-child) {
		align-self: center;
	}

	.title {
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--text);
	}

	.subtitle {
		margin-left: auto;
		font-size: 0.6875rem;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.7rem;
	}

	.preset {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 1.65rem;
		padding: 0 0.6rem 0 0.5rem;
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
		padding: 0.8rem 1rem;
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

	/* Label beside the field: one short line doesn't need a row of its own. */
	.name-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.name-row .label {
		flex-shrink: 0;
		margin-bottom: 0;
	}

	.name-input {
		flex: 1;
		min-width: 0;
		font-weight: 500;
	}

	/* One line that scrolls sideways, fading at the edge, rather than a block of
	   chips that pushes everything below it down. */
	.columns {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.55rem;
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(90deg, #000 calc(100% - 2rem), transparent);
	}

	.columns::-webkit-scrollbar {
		display: none;
	}

	.colchip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
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

	/* Something to do, not just something wrong: what happened and the fix. */
	.notice {
		padding: 0.8rem 1rem 0;
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
</style>
