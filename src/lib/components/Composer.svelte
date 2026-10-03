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
		Tick02Icon,
		ViewIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { autogrow } from '$lib/actions/autogrow';
	import PromptEditor from './PromptEditor.svelte';
	import Select from './Select.svelte';
	import OutputEditor from './OutputEditor.svelte';
	import ScopeEditor from './ScopeEditor.svelte';
	import PreviewDialog from './PreviewDialog.svelte';
	import RunDock from './RunDock.svelte';
	import { PRESETS, presetById } from '$lib/core/presets';
	import { models } from '$lib/state/models.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';
	import type { Column, OutputKind } from '$lib/core/types';

	interface Props {
		ws: Workspace;
	}

	let { ws }: Props = $props();

	let editor = $state<PromptEditor | null>(null);
	let dock = $state<RunDock | null>(null);
	let notice = $state<HTMLDivElement | null>(null);
	let showPreview = $state(false);
	let copiedCommand = $state('');

	const jobIcons: Record<string, IconSvgElement> = {
		classify: Tag01Icon,
		decide: ThumbsUpIcon,
		summarize: TextAlignLeftIcon,
		score: StarIcon,
		blank: QuillWrite02Icon
	};

	const jobOptions = PRESETS.map((preset) => ({
		value: preset.id,
		label: preset.id === 'blank' ? 'Custom' : preset.label,
		icon: jobIcons[preset.id],
		description: preset.blurb
	}));

	/** What a column is doing when nothing says otherwise, read from the answer it asks for. */
	const jobForKind: Record<OutputKind, string> = {
		choice: 'classify',
		boolean: 'decide',
		number: 'score',
		text: 'blank'
	};

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	// The job it started from, unless the answer has since changed shape under it.
	const job = $derived.by(() => {
		const chosen = config.job ? presetById(config.job) : null;
		return chosen && chosen.output.kind === config.output.kind
			? chosen.id
			: jobForKind[config.output.kind];
	});

	export function insertColumn(column: Column) {
		void editor?.insertColumn(column);
	}

	/** Also reached with ⌘↵ / Ctrl ↵ from anywhere in the workspace. */
	export function run() {
		dock?.run();
	}

	/** Reached from the dock when Ollama is what's stopping a run. */
	export function showNotice() {
		notice?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function applyJob(id: string) {
		const preset = presetById(id);
		config.job = preset.id;
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

{#snippet promptActions()}
	<button
		type="button"
		class="tool"
		disabled={busy}
		onclick={() => editor?.openPalette()}
		use:tooltip={{ text: 'Insert a column at the cursor, or type', kbd: '{{' }}
	>
		<Icon icon={Add01Icon} size={13} strokeWidth={2} />
		Insert column
	</button>
	<button
		type="button"
		class="tool end"
		onclick={() => (showPreview = true)}
		disabled={!config.template.trim() || issues.unknown.length > 0}
		use:tooltip={'See the exact prompt one row will send, and try it'}
	>
		<Icon icon={ViewIcon} size={14} />
		Preview
	</button>
{/snippet}

<aside class="composer">
	<div class="body">
		<!-- Nothing can run without Ollama, so its problem comes first. -->
		{#if models.problem}
			<div class="callout" role="alert" bind:this={notice}>
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
						class="btn btn-soft retry"
						onclick={() => models.scan()}
						disabled={models.loading}
					>
						<Icon icon={RefreshIcon} size={14} class={models.loading ? 'spin' : ''} />
						Try again
					</button>
				</div>
			</div>
		{/if}

		<section class="section">
			<div class="pair">
				<div>
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
				<div>
					<label class="label" for="job">Job</label>
					<Select
						id="job"
						block
						options={jobOptions}
						value={job}
						disabled={busy}
						onchange={applyJob}
					/>
				</div>
			</div>
			{#if ws.targetColumn && !ws.targetColumn.generated}
				<p class="hint">This name matches an imported column. The run will write over it.</p>
			{/if}
		</section>

		<section class="section">
			<label class="label" for="prompt-editor">Prompt</label>
			<PromptEditor
				bind:this={editor}
				bind:value={config.template}
				columns={ws.columns}
				disabled={busy}
				placeholder={'Summarize this row in one sentence.\n\nNotes: {{Raw notes}}'}
				footer={promptActions}
			/>
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
					This prompt has no column reference, so every row gets the same answer. Insert a column to
					fix that.
				</p>
			{/if}
		</section>

		<section class="section">
			<span class="label">Answer</span>
			<OutputEditor bind:spec={config.output} disabled={busy} />
		</section>

		<section class="section">
			<div class="label-row">
				<label class="label" for="instructions">Rules</label>
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

		<section class="section">
			<label class="label" for="scope">Rows to run</label>
			<ScopeEditor
				id="scope"
				bind:scope={config.scope}
				bind:overwrite={config.overwrite}
				rowCount={ws.rows.length}
				selectedCount={ws.selected.size}
				hasTarget={ws.targetColumn !== null}
				disabled={busy}
			/>
		</section>
	</div>

	<RunDock bind:this={dock} {ws} onShowNotice={showNotice} />
</aside>

{#if showPreview}
	<PreviewDialog {ws} host={models.host} onClose={() => (showPreview = false)} />
{/if}

<style>
	/* Solid by default. The workspace swaps these for frosted glass when the
	   panel is laid over the sheet on a narrow screen. */
	.composer {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		height: 100%;
		min-height: 0;
		background: var(--composer-bg, var(--surface));
	}

	/* Sections are told apart by space and their labels, not by rules between them. */
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 1.35rem;
		min-height: 0;
		overflow-y: auto;
		padding: 1.1rem 1rem 1.5rem;
	}

	.section {
		display: grid;
		min-width: 0;
	}

	.label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.optional {
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.5rem;
	}

	.name-input {
		height: 2.25rem;
		font-weight: 500;
	}

	.rules {
		max-height: 12rem;
	}

	/* Actions inside the prompt field: quiet text buttons, not more boxes. */
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.75rem;
		padding: 0 0.5rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-2);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.tool:hover:not(:disabled) {
		background: color-mix(in oklch, var(--text) 7%, transparent);
		color: var(--text);
	}

	.tool:disabled {
		opacity: 0.45;
	}

	.tool.end {
		margin-left: auto;
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

	/* Something to do, not just something wrong: what happened and the fix. */
	.callout {
		display: flex;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: var(--radius-panel);
		background: color-mix(in oklch, var(--danger-soft) 45%, var(--surface));
		scroll-margin-top: 1rem;
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
		background: var(--field);
		color: var(--text);
	}

	.retry {
		height: 1.75rem;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		background: var(--surface);
	}
</style>
