<script lang="ts">
	import {
		Add01Icon,
		Cancel01Icon,
		HashtagIcon,
		Tag01Icon,
		TextIcon,
		ToggleOnIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import { labelTone } from '$lib/core/columns';
	import Icon from '$lib/components/Icon.svelte';
	import NumberField from './NumberField.svelte';
	import type { OutputKind, OutputSpec } from '$lib/core/types';

	interface Props {
		spec: OutputSpec;
		disabled?: boolean;
	}

	let { spec = $bindable(), disabled = false }: Props = $props();

	const kinds: Array<{ id: OutputKind; label: string; hint: string; icon: IconSvgElement }> = [
		{ id: 'choice', label: 'Label', hint: 'One value from a list you define', icon: Tag01Icon },
		{ id: 'boolean', label: 'Yes / no', hint: 'Two labels, nothing else', icon: ToggleOnIcon },
		{ id: 'number', label: 'Number', hint: 'A number inside a range', icon: HashtagIcon },
		{ id: 'text', label: 'Free text', hint: 'A short written answer', icon: TextIcon }
	];

	let draftChoice = $state('');

	function addChoice() {
		const value = draftChoice.trim();
		if (!value) return;
		if (spec.choices.some((choice) => choice.toLowerCase() === value.toLowerCase())) {
			draftChoice = '';
			return;
		}
		spec.choices = [...spec.choices, value];
		draftChoice = '';
	}

	function removeChoice(value: string) {
		spec.choices = spec.choices.filter((choice) => choice !== value);
	}
</script>

<div class="grid gap-3">
	<div>
		<span class="label">Answer shape</span>
		<div class="segmented" role="radiogroup" aria-label="Answer shape">
			{#each kinds as kind (kind.id)}
				<button
					type="button"
					role="radio"
					aria-checked={spec.kind === kind.id}
					class="seg"
					class:on={spec.kind === kind.id}
					title={kind.hint}
					{disabled}
					onclick={() => (spec.kind = kind.id)}
				>
					<Icon icon={kind.icon} size={13} />
					{kind.label}
				</button>
			{/each}
		</div>
	</div>

	{#if spec.kind === 'choice'}
		<div>
			<span class="label">Allowed labels</span>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each spec.choices as choice (choice)}
					<span class="tag choice tone-{labelTone(choice)}">
						{choice}
						<button
							type="button"
							class="remove"
							aria-label={`Remove ${choice}`}
							{disabled}
							onclick={() => removeChoice(choice)}
						>
							<Icon icon={Cancel01Icon} size={11} strokeWidth={2} />
						</button>
					</span>
				{/each}
				{#if !spec.choices.length}
					<span class="text-xs text-ink-3">No labels yet. The model needs at least two.</span>
				{/if}
			</div>
			<div class="mt-2 flex gap-1.5">
				<input
					class="field"
					bind:value={draftChoice}
					placeholder="Add a label"
					{disabled}
					aria-label="New label"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							addChoice();
						}
					}}
				/>
				<button type="button" class="btn btn-outline" {disabled} onclick={addChoice}>
					<Icon icon={Add01Icon} size={14} strokeWidth={2} /> Add
				</button>
			</div>
			<label class="toggle mt-2.5">
				Accept answers outside this list
				<input type="checkbox" role="switch" bind:checked={spec.allowOther} {disabled} />
			</label>
		</div>
	{:else if spec.kind === 'boolean'}
		<div class="grid grid-cols-2 gap-2">
			<div>
				<label class="label" for="true-label">Write when yes</label>
				<input id="true-label" class="field" bind:value={spec.trueLabel} {disabled} />
			</div>
			<div>
				<label class="label" for="false-label">Write when no</label>
				<input id="false-label" class="field" bind:value={spec.falseLabel} {disabled} />
			</div>
		</div>
	{:else if spec.kind === 'number'}
		<div class="grid grid-cols-3 gap-2">
			<div>
				<label class="label" for="num-min">Lowest</label>
				<NumberField id="num-min" optional bind:value={spec.min} {disabled} />
			</div>
			<div>
				<label class="label" for="num-max">Highest</label>
				<NumberField id="num-max" optional bind:value={spec.max} {disabled} />
			</div>
			<div>
				<span class="label">Rounding</span>
				<label class="flex h-9 items-center gap-2 text-xs text-ink-2">
					<input type="checkbox" role="switch" bind:checked={spec.integer} {disabled} />
					Whole numbers
				</label>
			</div>
		</div>
	{:else}
		<div>
			<label class="label" for="max-words">Length budget</label>
			<div class="flex items-center gap-2">
				<div class="w-24 shrink-0">
					<NumberField id="max-words" optional min={1} bind:value={spec.maxWords} {disabled} />
				</div>
				<span class="text-xs text-ink-3">words at most. Leave empty for no limit.</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.segmented {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 2px;
		padding: 2px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
	}

	.seg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		height: 1.85rem;
		padding: 0 0.25rem;
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--text-2);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease;
	}

	.seg:hover:not(.on):not(:disabled) {
		color: var(--text);
	}

	.seg.on {
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		box-shadow:
			var(--inner-highlight),
			0 0 0 1px var(--line),
			var(--elev-1);
	}

	.seg.on :global(.hi) {
		color: var(--accent-text);
	}

	/* The allowed labels, coloured as they will be in the grid. */
	.choice {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding-right: 0.3rem;
	}

	.remove {
		display: grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		color: inherit;
		opacity: 0.6;
		transition:
			opacity var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}

	.remove:hover:not(:disabled) {
		opacity: 1;
		background: color-mix(in oklch, currentColor 15%, transparent);
	}

	.seg:disabled {
		opacity: 0.5;
	}
</style>
