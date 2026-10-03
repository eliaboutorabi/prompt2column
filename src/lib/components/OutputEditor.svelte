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
	import { tooltip } from '$lib/actions/tooltip';
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
		{ id: 'text', label: 'Text', hint: 'A short written answer', icon: TextIcon }
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

<div class="output">
	<div class="segmented" role="radiogroup" aria-label="Answer shape">
		{#each kinds as kind (kind.id)}
			<button
				type="button"
				role="radio"
				aria-checked={spec.kind === kind.id}
				class="seg"
				class:on={spec.kind === kind.id}
				use:tooltip={kind.hint}
				{disabled}
				onclick={() => (spec.kind = kind.id)}
			>
				<Icon icon={kind.icon} size={13} />
				{kind.label}
			</button>
		{/each}
	</div>

	{#if spec.kind === 'choice'}
		<!-- The labels read as they will in the grid, with the field that adds one at the end. -->
		<div class="choices" role="group" aria-label="Allowed labels">
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
			<span class="adder">
				<Icon icon={Add01Icon} size={12} strokeWidth={2} />
				<input
					bind:value={draftChoice}
					placeholder={spec.choices.length < 2 ? 'Add at least two labels' : 'Add a label'}
					{disabled}
					aria-label="New label"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							addChoice();
						}
					}}
					onblur={addChoice}
				/>
			</span>
		</div>
		<label class="toggle">
			Accept answers outside this list
			<input type="checkbox" role="switch" bind:checked={spec.allowOther} {disabled} />
		</label>
	{:else if spec.kind === 'boolean'}
		<div class="pair">
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
		<div class="pair">
			<div>
				<label class="label" for="num-min">Lowest</label>
				<NumberField id="num-min" optional bind:value={spec.min} {disabled} />
			</div>
			<div>
				<label class="label" for="num-max">Highest</label>
				<NumberField id="num-max" optional bind:value={spec.max} {disabled} />
			</div>
		</div>
		<label class="toggle">
			Whole numbers only
			<input type="checkbox" role="switch" bind:checked={spec.integer} {disabled} />
		</label>
	{:else}
		<div class="inline">
			<span class="words">
				<NumberField
					id="max-words"
					optional
					min={1}
					bind:value={spec.maxWords}
					{disabled}
					label="Length budget in words"
				/>
			</span>
			<span class="note">words at most. Leave empty for no limit.</span>
		</div>
	{/if}
</div>

<style>
	.output {
		display: grid;
		gap: 0.75rem;
	}

	/* A soft track with the chosen shape raised out of it. */
	.segmented {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 2px;
		padding: 3px;
		background: var(--field);
		border-radius: var(--radius-control);
	}

	.seg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		height: 1.75rem;
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
		box-shadow: var(--inner-highlight), var(--elev-1);
	}

	.seg.on :global(.hi) {
		color: var(--accent-text);
	}

	.seg:disabled {
		opacity: 0.5;
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
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

	/* A bare line of text until it is used: no box of its own in the row of labels. */
	.adder {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex: 1 1 6rem;
		min-width: 6rem;
		height: 1.35rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		color: var(--text-3);
		transition:
			background-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease;
	}

	.adder:hover {
		background: var(--field);
	}

	.adder:focus-within {
		background: var(--surface);
		box-shadow:
			0 0 0 1px var(--accent),
			var(--ring);
		color: var(--text-2);
	}

	.adder input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		outline: none;
		font-size: 0.75rem;
		color: var(--text);
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.words {
		width: 5.5rem;
		flex-shrink: 0;
	}

	.note {
		font-size: 0.75rem;
		color: var(--text-3);
	}
</style>
