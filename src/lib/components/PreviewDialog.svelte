<script lang="ts">
	import { ArrowsClockwise, CaretLeft, CaretRight, Play, X } from 'phosphor-svelte';
	import { renderTemplate } from '$lib/core/template';
	import { buildSchema, buildSystemPrompt, coerce } from '$lib/core/output';
	import { complete } from '$lib/core/ollama';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
		host: string;
		onClose: () => void;
	}

	let { ws, host, onClose }: Props = $props();

	let index = $state(0);
	let testing = $state(false);
	let result = $state('');
	let resultError = $state('');
	let durationMs = $state(0);

	const rows = $derived(ws.scopedRows.length ? ws.scopedRows : ws.rows);
	const row = $derived(rows[Math.min(index, Math.max(0, rows.length - 1))]);
	const config = $derived(ws.project?.config ?? null);
	const rendered = $derived(
		row && config ? renderTemplate(config.template, row, ws.columns) : null
	);
	const system = $derived(
		config ? buildSystemPrompt(config.output, config.targetColumnName, config.instructions) : ''
	);

	function move(step: number) {
		index = (index + step + rows.length) % rows.length;
		result = '';
		resultError = '';
	}

	async function test() {
		if (!config || !rendered) return;
		testing = true;
		result = '';
		resultError = '';
		const started = Date.now();
		try {
			const response = await complete({
				host,
				model: config.model,
				system,
				prompt: rendered.text,
				schema: buildSchema(config.output),
				temperature: config.temperature,
				numPredict: config.numPredict,
				think: config.think
			});
			const parsed = coerce(config.output, response.content);
			if (parsed.ok) result = parsed.value;
			else resultError = parsed.reason;
		} catch (error) {
			resultError = error instanceof Error ? error.message : String(error);
		} finally {
			durationMs = Date.now() - started;
			testing = false;
		}
	}

	function dialog(node: HTMLDialogElement) {
		node.showModal();
		return { destroy: () => node.close() };
	}
</script>

<dialog use:dialog class="sheet" onclose={onClose} oncancel={onClose} aria-label="Prompt preview">
	<header>
		<div>
			<h2 class="text-sm font-semibold text-ink">Prompt preview</h2>
			<p class="text-xs text-ink-3">Exactly what one row sends to the model.</p>
		</div>
		<div class="flex items-center gap-1">
			<button class="btn btn-ghost px-2" onclick={() => move(-1)} aria-label="Previous row">
				<CaretLeft size={15} />
			</button>
			<span class="min-w-16 text-center font-mono text-xs text-ink-2">
				{rows.length ? index + 1 : 0} / {rows.length}
			</span>
			<button class="btn btn-ghost px-2" onclick={() => move(1)} aria-label="Next row">
				<CaretRight size={15} />
			</button>
			<button class="btn btn-ghost px-2" onclick={onClose} aria-label="Close preview">
				<X size={15} />
			</button>
		</div>
	</header>

	<div class="body">
		{#if !row || !rendered}
			<p class="text-sm text-ink-2">No rows match the current selection.</p>
		{:else}
			<section>
				<span class="cap">Rules sent as the system message</span>
				<pre class="system block">{system}</pre>
			</section>
			<section>
				<span class="cap">Row {ws.rows.indexOf(row) + 1} filled into your prompt</span>
				<pre class="block">{rendered.text}</pre>
				{#if rendered.emptyColumns.length}
					<p class="mt-1.5 text-xs text-ink-3">
						Empty in this row: {rendered.emptyColumns.join(', ')}
					</p>
				{/if}
			</section>
			<section>
				<div class="flex items-center justify-between gap-3">
					<span class="cap">Answer</span>
					<button class="btn btn-outline" onclick={test} disabled={testing || !config?.model}>
						{#if testing}
							<ArrowsClockwise size={14} class="spin" /> Running
						{:else}
							<Play size={14} weight="fill" /> Test this row
						{/if}
					</button>
				</div>
				{#if result}
					<p class="answer">{result}</p>
					<p class="mt-1 font-mono text-xs text-ink-3">{(durationMs / 1000).toFixed(1)}s</p>
				{:else if resultError}
					<p class="answer failed">{resultError}</p>
				{:else}
					<p class="text-xs text-ink-3">
						Nothing yet. One test run costs a single call and writes nothing to the sheet.
					</p>
				{/if}
			</section>
		{/if}
	</div>
</dialog>

<style>
	.sheet {
		width: min(46rem, calc(100vw - 2rem));
		max-height: min(80vh, 46rem);
		margin: auto;
		padding: 0;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pop);
		overflow: hidden;
	}

	.sheet::backdrop {
		background: oklch(0.2 0.01 110 / 0.45);
		backdrop-filter: blur(2px);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.75rem 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	.body {
		display: grid;
		gap: 1.1rem;
		padding: 1rem;
		overflow: auto;
		max-height: calc(80vh - 4rem);
	}

	.cap {
		display: block;
		font-size: 0.6875rem;
		color: var(--text-3);
		margin-bottom: 0.35rem;
	}

	.block {
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		padding: 0.65rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		max-height: 15rem;
		overflow: auto;
	}

	.system {
		color: var(--text-2);
	}

	.answer {
		background: var(--accent-soft);
		border: 1px solid var(--accent-line);
		border-radius: var(--radius-control);
		padding: 0.55rem 0.7rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	.answer.failed {
		background: var(--danger-soft);
		border-color: var(--danger-line);
		color: var(--danger);
	}

	:global(.spin) {
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
