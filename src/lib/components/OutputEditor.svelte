<script lang="ts">
	import { Plus, X } from 'phosphor-svelte';
	import type { OutputKind, OutputSpec } from '$lib/core/types';

	interface Props {
		spec: OutputSpec;
		disabled?: boolean;
	}

	let { spec = $bindable(), disabled = false }: Props = $props();

	const kinds: Array<{ id: OutputKind; label: string; hint: string }> = [
		{ id: 'choice', label: 'Label', hint: 'One value from a list you define' },
		{ id: 'boolean', label: 'Yes / no', hint: 'Two labels, nothing else' },
		{ id: 'number', label: 'Number', hint: 'A number inside a range' },
		{ id: 'text', label: 'Free text', hint: 'A short written answer' }
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
					<span class="chip border border-line-strong bg-surface-2 text-ink">
						{choice}
						<button
							type="button"
							class="text-ink-3 hover:text-danger"
							aria-label={`Remove ${choice}`}
							{disabled}
							onclick={() => removeChoice(choice)}
						>
							<X size={11} weight="bold" />
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
					<Plus size={14} weight="bold" /> Add
				</button>
			</div>
			<label class="mt-2 flex items-center gap-2 text-xs text-ink-2">
				<input
					type="checkbox"
					class="size-3.5 accent-accent"
					bind:checked={spec.allowOther}
					{disabled}
				/>
				Accept an answer outside this list instead of failing the row
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
				<input
					id="num-min"
					type="number"
					class="field"
					value={spec.min ?? ''}
					{disabled}
					oninput={(event) =>
						(spec.min =
							event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
				/>
			</div>
			<div>
				<label class="label" for="num-max">Highest</label>
				<input
					id="num-max"
					type="number"
					class="field"
					value={spec.max ?? ''}
					{disabled}
					oninput={(event) =>
						(spec.max =
							event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
				/>
			</div>
			<div>
				<span class="label">Rounding</span>
				<label class="flex h-[2.05rem] items-center gap-2 text-xs text-ink-2">
					<input
						type="checkbox"
						class="size-3.5 accent-accent"
						bind:checked={spec.integer}
						{disabled}
					/>
					Whole numbers
				</label>
			</div>
		</div>
	{:else}
		<div>
			<label class="label" for="max-words">Length budget</label>
			<div class="flex items-center gap-2">
				<input
					id="max-words"
					type="number"
					min="1"
					class="field w-24"
					value={spec.maxWords ?? ''}
					{disabled}
					oninput={(event) =>
						(spec.maxWords =
							event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
				/>
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
		padding: 0.3rem 0.25rem;
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--text-2);
		transition:
			background-color 0.14s ease,
			color 0.14s ease;
	}

	.seg:hover:not(.on):not(:disabled) {
		color: var(--text);
	}

	.seg.on {
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		box-shadow: var(--shadow-panel);
	}

	.seg:disabled {
		opacity: 0.5;
	}
</style>
