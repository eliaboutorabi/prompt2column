<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import type { IconSvgElement } from '@hugeicons/svelte';

	interface Props extends Omit<HTMLSelectAttributes, 'value' | 'size' | 'class'> {
		value?: string;
		/** Toolbar size, to sit beside the search field. */
		compact?: boolean;
		/** Fill the width of its container. */
		block?: boolean;
		/** Classes for the wrapper, such as spacing utilities. */
		class?: string;
		/** Optional icon at the start, saying what the list chooses. */
		icon?: IconSvgElement;
		children: Snippet;
	}

	let {
		value = $bindable(''),
		compact = false,
		block = false,
		class: className = '',
		icon,
		children,
		...rest
	}: Props = $props();
</script>

<!--
	The browser's own arrow sits hard against the edge and can't be spaced or
	coloured, so it is hidden and replaced by an icon with room around it.
-->
<span class={['select', compact && 'compact', block && 'block', icon && 'lead', className]}>
	{#if icon}
		<Icon {icon} size={compact ? 13 : 15} class="lead-icon" />
	{/if}
	<select bind:value {...rest}>
		{@render children()}
	</select>
	<Icon icon={ArrowDown01Icon} size={compact ? 11 : 12} class="chevron" strokeWidth={2} />
</span>

<style>
	.select {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}

	.select.block {
		display: flex;
		width: 100%;
	}

	select {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		min-width: 0;
		height: 2.25rem;
		padding: 0 2.1rem 0 0.7rem;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		font-size: 0.8125rem;
		color: var(--text);
		text-overflow: ellipsis;
		cursor: pointer;
		transition:
			border-color 0.14s ease,
			box-shadow 0.14s ease;
	}

	.compact select {
		height: 1.9rem;
		padding: 0 1.85rem 0 0.6rem;
		border-color: var(--line);
		font-size: 0.75rem;
		color: var(--text-2);
	}

	select:hover:not(:disabled) {
		border-color: var(--text-3);
	}

	select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.lead select {
		padding-left: 2.1rem;
	}

	.lead.compact select {
		padding-left: 1.85rem;
	}

	.select :global(.lead-icon) {
		position: absolute;
		left: 0.7rem;
		color: var(--text-3);
		pointer-events: none;
	}

	.compact :global(.lead-icon) {
		left: 0.6rem;
	}

	.select :global(.chevron) {
		position: absolute;
		right: 0.75rem;
		color: var(--text-3);
		pointer-events: none;
		transition: color 0.14s ease;
	}

	.compact :global(.chevron) {
		right: 0.65rem;
	}

	.select:hover :global(.chevron) {
		color: var(--text-2);
	}
</style>
