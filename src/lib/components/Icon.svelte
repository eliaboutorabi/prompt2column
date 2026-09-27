<script lang="ts">
	import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/svelte';

	interface Props {
		icon: IconSvgElement;
		size?: number;
		/** One stroke weight across the app; heavier only where an icon must read small. */
		strokeWidth?: number;
		class?: string;
		/** Set when the icon carries meaning on its own; otherwise it is hidden from screen readers. */
		label?: string;
	}

	let { icon, size = 16, strokeWidth = 1.6, class: className = '', label }: Props = $props();
</script>

<!--
	HugeiconsIcon draws its paths once when it mounts and ignores a later change to
	`icon`, so a swapped icon (Copy to Copied, the theme toggle) would stick. Keying
	on the icon remounts it.
-->
{#key icon}
	<HugeiconsIcon
		{icon}
		{size}
		{strokeWidth}
		class={`hi ${className}`.trim()}
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	/>
{/key}
