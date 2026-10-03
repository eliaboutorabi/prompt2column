<script lang="ts">
	import { Settings02Icon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import NumberField from './NumberField.svelte';
	import { models } from '$lib/state/models.svelte';
	import type { GenConfig } from '$lib/core/types';

	interface Props {
		config: GenConfig;
		disabled?: boolean;
	}

	let { config = $bindable(), disabled = false }: Props = $props();

	const panelId = `run-settings-${Math.random().toString(36).slice(2, 9)}`;
	let trigger = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);

	/** Lives in the top layer like the model list, opening upward out of the status bar. */
	function place() {
		if (!trigger || !panel) return;
		const box = trigger.getBoundingClientRect();
		const width = panel.offsetWidth || 288;
		panel.style.left = `${Math.min(Math.max(8, box.left), window.innerWidth - width - 8)}px`;
		panel.style.bottom = `${window.innerHeight - box.top + 6}px`;
	}

	$effect(() => {
		const element = panel;
		if (!element) return;
		const toggle = (event: Event) => {
			open = (event as ToggleEvent).newState === 'open';
			if (open) place();
		};
		const onResize = () => open && place();
		element.addEventListener('beforetoggle', place);
		element.addEventListener('toggle', toggle);
		window.addEventListener('resize', onResize);
		return () => {
			element.removeEventListener('beforetoggle', place);
			element.removeEventListener('toggle', toggle);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<button
	bind:this={trigger}
	type="button"
	class={['trigger', open && 'open']}
	aria-label="Run settings"
	aria-expanded={open}
	aria-controls={panelId}
	popovertarget={panelId}
	use:tooltip={'Run settings'}
>
	<Icon icon={Settings02Icon} size={15} />
</button>

<div
	bind:this={panel}
	id={panelId}
	class="panel pop"
	popover="auto"
	role="dialog"
	aria-label="Run settings"
>
	<div class="grid grid-cols-2 gap-2">
		<div>
			<label class="label" for="concurrency">Rows at once</label>
			<NumberField id="concurrency" min={1} max={8} bind:value={config.concurrency} {disabled} />
		</div>
		<div>
			<label class="label" for="temperature">Temperature</label>
			<NumberField
				id="temperature"
				min={0}
				max={1}
				step={0.1}
				bind:value={config.temperature}
				{disabled}
			/>
		</div>
	</div>
	<div>
		<label class="label" for="host">Ollama address</label>
		<input
			id="host"
			class="field"
			value={models.host}
			{disabled}
			onchange={(event) => {
				models.setHost(event.currentTarget.value);
				void models.scan();
			}}
		/>
	</div>
	<label class="toggle">
		Let thinking models reason first (slower)
		<input type="checkbox" role="switch" bind:checked={config.think} {disabled} />
	</label>
</div>

<style>
	.trigger {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-control);
		color: var(--text-2);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.trigger:hover,
	.trigger.open {
		background: var(--field);
		color: var(--text);
	}

	.panel {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 18rem;
		display: none;
		gap: 0.75rem;
		padding: 0.85rem;
		border-radius: var(--radius-panel);
		background: var(--surface);
		border: 1px solid var(--line-strong);
		box-shadow: var(--shadow-pop);
		transform-origin: bottom left;
		color: var(--text);
	}

	/* Rises out of the dock it belongs to. */
	.panel:popover-open {
		display: grid;
		animation: rise-in var(--dur) var(--ease-out);
	}
</style>
