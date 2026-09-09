<script lang="ts">
	import { findColumn, parseTemplate } from '$lib/core/template';
	import type { Column } from '$lib/core/types';

	interface Props {
		value: string;
		columns: Column[];
		/** Trailing newline keeps the overlay tall enough while typing. */
		pad?: boolean;
	}

	let { value, columns, pad = true }: Props = $props();

	const segments = $derived(parseTemplate(value));

	const OPEN = '{{';
	const CLOSE = '}}';
	// A trailing newline keeps the overlay as tall as the textarea while typing.
	const tail = $derived(pad ? '\n' : '');
</script>

{#each segments as segment, index (index)}
	{#if segment.type === 'text'}{segment.value}{:else}<span
			class="token"
			class:unknown={!findColumn(columns, segment.name)}>{OPEN}{segment.name}{CLOSE}</span
		>{/if}
{/each}{tail}

<style>
	.token {
		background: var(--accent-soft);
		color: var(--accent-text);
		border-radius: 3px;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	.token.unknown {
		background: var(--danger-soft);
		color: var(--danger);
		text-decoration: underline wavy var(--danger-line);
		text-underline-offset: 3px;
	}
</style>
