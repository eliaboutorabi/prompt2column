<script lang="ts">
	import {
		AlertCircleIcon,
		CheckmarkCircle02Icon,
		PauseIcon,
		PlayIcon,
		RefreshIcon,
		StopIcon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import Select from './Select.svelte';
	import RunSettings from './RunSettings.svelte';
	import { formatModelSize, isCloudModel } from '$lib/core/ollama';
	import { models } from '$lib/state/models.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
		/** Brings the panel's "Ollama isn't reachable" help into view. */
		onShowNotice: () => void;
	}

	let { ws, onShowNotice }: Props = $props();

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	const matchCount = $derived(ws.scopedRows.length);
	const finished = $derived(ws.runDone + ws.runFailed);
	const percent = $derived(ws.runTotal ? Math.round((finished / ws.runTotal) * 100) : 0);
	const perRowMs = $derived(finished > 0 ? ws.runElapsedMs / finished : 0);
	const remainingMs = $derived(perRowMs * Math.max(0, ws.runTotal - finished));
	const modelKnown = $derived(models.models.some((model) => model.name === config.model));
	// What the model list can say at a glance: size, and whether it reasons or sees images.
	const modelOptions = $derived(
		models.models.map((model) => ({
			value: model.name,
			label: model.name,
			hint: formatModelSize(model.size),
			badges: [
				...(isCloudModel(model.name) ? ['cloud'] : []),
				...model.capabilities.filter((capability) => ['thinking', 'vision'].includes(capability))
			]
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
	/** What the line above the buttons is about: a run in hand, the last run, or getting ready. */
	const mode = $derived(
		busy ? 'running' : blocker ? 'blocked' : ws.runTotal > 0 ? 'result' : 'ready'
	);

	/** Also reached with ⌘↵ / Ctrl ↵ from anywhere in the workspace. */
	export function run() {
		if (runnable) void ws.run(models.host);
	}

	function formatDuration(ms: number): string {
		if (!Number.isFinite(ms) || ms <= 0) return '0s';
		const seconds = Math.round(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
	}
</script>

{#snippet connection()}
	<button
		type="button"
		class={['conn', models.loading ? 'checking' : models.error ? 'offline' : 'online']}
		onclick={() => models.scan()}
		disabled={models.loading}
		use:tooltip={models.error
			? 'Ollama is not answering. Click to try again.'
			: `Ollama at ${models.host.replace(/^https?:\/\//, '')}. Click to rescan.`}
	>
		<span class="dot" aria-hidden="true"></span>
		{#if models.loading}
			Connecting
		{:else if models.error}
			Ollama offline
		{:else}
			{models.models.length}
			{models.models.length === 1 ? 'model' : 'models'}
		{/if}
	</button>
{/snippet}

<!-- The panel's foot: what will happen or is happening, and the buttons that make it happen. -->
<footer class={['dock', busy && 'busy']} aria-label="Run">
	<!-- The dock's top edge doubles as the progress bar while a run is going. -->
	<div class="edge" aria-hidden="true">
		{#if busy}
			<div class={['fill', ws.runState === 'running' && 'live']} style:width="{percent}%"></div>
		{/if}
	</div>

	<div class="status" role="status" aria-live="polite">
		{#if mode === 'running'}
			<span class="state">
				{#if ws.runState === 'paused'}
					<Icon icon={PauseIcon} size={13} /> Paused
				{:else}
					<span class="pulse" aria-hidden="true"></span> Running
				{/if}
			</span>
			<span class="count">{finished} / {ws.runTotal} rows</span>
			<span class="meta">
				{#if ws.runFailed}
					<span class="failed">{ws.runFailed} failed</span>
				{:else}
					{formatDuration(remainingMs)} left
				{/if}
			</span>
		{:else if mode === 'blocked'}
			{@render connection()}
			{#if models.problem}
				<button type="button" class="blocker link" onclick={onShowNotice}>{blocker}</button>
			{:else}
				<span class="blocker">{blocker}</span>
			{/if}
		{:else if mode === 'result'}
			<span class={['state', ws.runFailed ? 'warn' : 'done']}>
				{#if ws.runFailed}
					<Icon icon={AlertCircleIcon} size={14} />
					{ws.runFailed} failed
				{:else if ws.runState === 'stopped'}
					<Icon icon={StopIcon} size={13} /> Stopped
				{:else}
					<Icon icon={CheckmarkCircle02Icon} size={14} /> Done
				{/if}
			</span>
			<span class="count">{finished} / {ws.runTotal} rows</span>
			{#if ws.runFailed}
				<button type="button" class="retry" onclick={() => ws.retryFailed(models.host)}>
					<Icon icon={RefreshIcon} size={13} />
					Retry
				</button>
			{:else}
				<span class="meta">{formatDuration(ws.runElapsedMs)}</span>
			{/if}
		{:else}
			{@render connection()}
			<span class="ready">Writes to <b>{config.targetColumnName.trim()}</b></span>
		{/if}
	</div>

	<div class="controls">
		<RunSettings bind:config={ws.project!.config} disabled={busy} />
		<span class="model">
			<Select
				label="Model"
				block
				hintInTrigger={false}
				options={modelOptions}
				value={modelKnown ? config.model : ''}
				placeholder={models.models.length ? 'Choose a model' : 'No models found'}
				disabled={busy || !models.models.length}
				onchange={(value) => {
					config.model = value;
					ws.touch();
				}}
			/>
		</span>

		{#if ws.runState === 'running'}
			<button type="button" class="btn btn-soft action" onclick={() => ws.pause()}>
				<Icon icon={PauseIcon} size={15} /> Pause
			</button>
			<button
				type="button"
				class="btn btn-soft btn-icon square"
				aria-label="Stop"
				use:tooltip={'Stop the run'}
				onclick={() => ws.stop()}
			>
				<Icon icon={StopIcon} size={15} />
			</button>
		{:else if ws.runState === 'paused'}
			<button type="button" class="btn btn-primary action" onclick={() => ws.resume()}>
				<Icon icon={PlayIcon} size={15} /> Resume
			</button>
			<button
				type="button"
				class="btn btn-soft btn-icon square"
				aria-label="Stop"
				use:tooltip={'Stop the run'}
				onclick={() => ws.stop()}
			>
				<Icon icon={StopIcon} size={15} />
			</button>
		{:else}
			<button
				type="button"
				class="btn btn-primary action"
				disabled={!runnable}
				use:tooltip={{ text: 'Run the prompt', kbd: isMac ? '⌘↵' : 'Ctrl ↵' }}
				onclick={run}
			>
				<Icon icon={PlayIcon} size={15} />
				Run on {matchCount}
				{matchCount === 1 ? 'row' : 'rows'}
			</button>
		{/if}
	</div>
</footer>

<style>
	.dock {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.55rem;
		padding: 0.7rem 0.85rem 0.85rem;
		background: var(--dock-bg, var(--surface));
	}

	/* A hairline that fills with the accent as rows come back. */
	.edge {
		position: absolute;
		inset: 0 0 auto;
		height: 1px;
		background: var(--line);
	}

	.busy .edge {
		height: 2px;
		background: var(--surface-3);
	}

	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.35s var(--ease-out);
	}

	/* A light sweep along the bar while rows are being written. */
	.fill.live {
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

	/* One line of words above the buttons, the same height whatever it says. */
	.status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		height: 1.5rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
		font-weight: 600;
		color: var(--text);
	}

	.state.done :global(.hi) {
		color: var(--accent-text);
	}

	.state.warn {
		color: var(--danger);
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
	.meta {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.count {
		color: var(--text-2);
	}

	.meta {
		margin-left: auto;
	}

	.failed {
		color: var(--danger);
	}

	/* Live connection state: the dot carries meaning, so it earns its colour. */
	.conn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
		height: 1.5rem;
		margin-left: -0.4rem;
		padding: 0 0.4rem;
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--text-2);
		white-space: nowrap;
		transition: background-color var(--dur-fast) ease;
	}

	.conn:hover:not(:disabled) {
		background: var(--field);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--text-3);
	}

	.online .dot {
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
	}

	.conn.offline {
		color: var(--danger);
	}

	.offline .dot {
		background: var(--danger);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--danger) 20%, transparent);
	}

	.checking .dot {
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.3;
		}
	}

	.blocker,
	.ready {
		margin-left: auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ready b {
		font-weight: 500;
		color: var(--text-2);
	}

	.blocker.link {
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
		text-underline-offset: 3px;
	}

	.blocker.link:hover {
		color: var(--text);
	}

	.retry {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.5rem;
		margin-left: auto;
		margin-right: -0.4rem;
		padding: 0 0.45rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text);
		transition: background-color var(--dur-fast) ease;
	}

	.retry:hover {
		background: var(--field);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.model {
		display: flex;
		flex: 1;
		min-width: 0;
	}

	.action {
		flex-shrink: 0;
		height: 2.25rem;
		padding: 0 0.9rem;
	}

	.square {
		width: 2.25rem;
		height: 2.25rem;
	}
</style>
