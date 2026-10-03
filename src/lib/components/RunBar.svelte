<script lang="ts">
	import {
		AiChipIcon,
		CheckmarkCircle02Icon,
		PauseIcon,
		PlayIcon,
		RefreshIcon,
		StopIcon,
		ViewIcon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import Select from './Select.svelte';
	import RunSettings from './RunSettings.svelte';
	import PreviewDialog from './PreviewDialog.svelte';
	import { formatModelSize, isCloudModel } from '$lib/core/ollama';
	import { models } from '$lib/state/models.svelte';
	import type { Workspace } from '$lib/state/workspace.svelte';

	interface Props {
		ws: Workspace;
		/** Brings the sidebar's "Ollama isn't reachable" help into view. */
		onShowNotice: () => void;
	}

	let { ws, onShowNotice }: Props = $props();

	let showPreview = $state(false);

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

	const config = $derived(ws.project!.config);
	const issues = $derived(ws.templateIssues);
	const busy = $derived(ws.isBusy);
	const matchCount = $derived(ws.scopedRows.length);
	const finished = $derived(ws.runDone + ws.runFailed);
	const percent = $derived(ws.runTotal ? Math.round((finished / ws.runTotal) * 100) : 0);
	const perRowMs = $derived(finished > 0 ? ws.runElapsedMs / finished : 0);
	const remainingMs = $derived(perRowMs * Math.max(0, ws.runTotal - finished));
	const showProgress = $derived(ws.isBusy || ws.runTotal > 0);
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

<footer class="runbar" aria-label="Run">
	<!-- Where the answers come from: the connection, the model, and how it's called. -->
	<div class="source">
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
			<span class="conn-text">
				{#if models.loading}
					Connecting
				{:else if models.error}
					Ollama offline
				{:else}
					{models.models.length}
					{models.models.length === 1 ? 'model' : 'models'}
				{/if}
			</span>
		</button>
		<span class="model">
			<Select
				icon={AiChipIcon}
				label="Model"
				compact
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
		</span>
		<RunSettings bind:config={ws.project!.config} disabled={busy} />
	</div>

	<!-- How the run is going, or what's stopping one from starting. -->
	<div class="middle">
		{#if showProgress}
			<div
				class={['progress', ws.runState === 'running' && 'live']}
				role="status"
				aria-live="polite"
			>
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
				<div class="track">
					<div class="fill" style:width="{percent}%"></div>
				</div>
				<span class="count">{finished} / {ws.runTotal} rows</span>
				<span class={['meta', ws.runFailed && 'failed']}>
					{#if ws.runFailed}
						{ws.runFailed} failed
					{:else if ws.isBusy}
						{ws.runDone} written
					{:else}
						All written
					{/if}
				</span>
				<span class="meta">
					{#if ws.isBusy}
						{formatDuration(remainingMs)} left
					{:else}
						{formatDuration(ws.runElapsedMs)} total
					{/if}
				</span>
			</div>
		{/if}

		{#if blocker && models.problem}
			<button type="button" class="blocker link" onclick={onShowNotice}>{blocker}</button>
		{:else if blocker}
			<p class="blocker">{blocker}</p>
		{:else if ws.runMessage && !ws.isBusy}
			<p class="message">{ws.runMessage}</p>
		{/if}
	</div>

	<div class="actions">
		{#if ws.runFailed > 0 && !ws.isBusy}
			<button type="button" class="btn btn-soft" onclick={() => ws.retryFailed(models.host)}>
				<Icon icon={RefreshIcon} size={15} />
				Retry {ws.runFailed} failed
			</button>
		{/if}

		<button
			type="button"
			class="btn btn-soft preview"
			onclick={() => (showPreview = true)}
			disabled={!config.template.trim() || issues.unknown.length > 0}
		>
			<Icon icon={ViewIcon} size={15} /> Preview
		</button>

		{#if ws.runState === 'running'}
			<button type="button" class="btn btn-soft wide" onclick={() => ws.pause()}>
				<Icon icon={PauseIcon} size={15} /> Pause
			</button>
			<button type="button" class="btn btn-soft" onclick={() => ws.stop()}>
				<Icon icon={StopIcon} size={15} /> Stop
			</button>
		{:else if ws.runState === 'paused'}
			<button type="button" class="btn btn-primary wide" onclick={() => ws.resume()}>
				<Icon icon={PlayIcon} size={15} /> Resume
			</button>
			<button type="button" class="btn btn-soft" onclick={() => ws.stop()}>
				<Icon icon={StopIcon} size={15} /> Stop
			</button>
		{:else}
			<button type="button" class="btn btn-primary wide" disabled={!runnable} onclick={run}>
				<Icon icon={PlayIcon} size={15} />
				Run on {matchCount}
				{matchCount === 1 ? 'row' : 'rows'}
				<kbd class="shortcut" aria-hidden="true">{isMac ? '⌘↵' : 'Ctrl ↵'}</kbd>
			</button>
		{/if}
	</div>
</footer>

{#if showPreview}
	<PreviewDialog {ws} host={models.host} onClose={() => (showPreview = false)} />
{/if}

<style>
	/* One line across the whole window: source on the left, the run on the right. */
	.runbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		height: 3.25rem;
		padding: 0 0.75rem;
		background: var(--surface);
		border-top: 1px solid var(--line);
	}

	.source {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.model {
		display: flex;
		width: 15rem;
		min-width: 0;
	}

	/* Live connection state: the dot carries meaning, so it earns its colour. */
	.conn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		height: 2rem;
		padding: 0 0.55rem;
		border-radius: var(--radius-control);
		font-size: 0.75rem;
		color: var(--text-2);
		white-space: nowrap;
		transition: background-color var(--dur-fast) ease;
	}

	.conn:hover:not(:disabled) {
		background: var(--surface-2);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--text-3);
	}

	.online .dot {
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
	}

	.offline {
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

	.middle {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		padding-left: 0.75rem;
		border-left: 1px solid var(--line);
		height: 1.75rem;
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
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

	.track {
		position: relative;
		flex: 1;
		min-width: 3rem;
		max-width: 22rem;
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

	.count,
	.meta {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.count {
		color: var(--text-2);
	}

	.meta.failed {
		color: var(--danger);
	}

	.blocker,
	.message {
		min-width: 0;
		font-size: 0.75rem;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.message {
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

	.actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.actions :global(.btn) {
		height: 2.15rem;
	}

	.wide {
		min-width: 7.5rem;
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

	/* Narrower windows keep the controls and drop the words around them. */
	@media (max-width: 1279px) {
		.meta {
			display: none;
		}
	}

	@media (max-width: 1023px) {
		.model {
			width: 11rem;
		}

		.conn-text,
		.track,
		.shortcut {
			display: none;
		}
	}

	@media (max-width: 639px) {
		.runbar {
			gap: 0.4rem;
			padding: 0 0.5rem;
		}

		.model {
			width: 8.5rem;
		}

		.middle {
			display: none;
		}

		.actions {
			margin-left: auto;
		}

		.preview {
			display: none;
		}
	}
</style>
