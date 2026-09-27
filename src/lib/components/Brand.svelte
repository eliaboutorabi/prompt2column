<script lang="ts">
	interface Props {
		/** Hide the wordmark and show only the mark, for tight headers. */
		markOnly?: boolean;
		size?: number;
	}

	let { markOnly = false, size = 22 }: Props = $props();
</script>

<!--
	The mark: two filled columns and a third drawn in outline, the one a prompt is
	about to fill. A single geometric shape rather than an illustration.
-->
<span class="brand">
	<svg class="mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
		<rect width="24" height="24" rx="6.5" class="tile" />
		<rect x="5.5" y="6" width="3.4" height="12" rx="1.2" class="bar" />
		<rect x="10.3" y="6" width="3.4" height="12" rx="1.2" class="bar" />
		<rect x="15.35" y="6.25" width="2.9" height="11.5" rx="1" class="slot" />
	</svg>
	{#if !markOnly}
		<span class="word">prompt<span class="two">2</span>column</span>
	{/if}
</span>

<style>
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.mark {
		flex-shrink: 0;
		filter: drop-shadow(0 1px 1.5px color-mix(in oklch, var(--accent-ink) 30%, transparent));
	}

	.tile {
		fill: var(--accent);
	}

	.bar {
		fill: var(--accent-ink);
	}

	.slot {
		fill: none;
		stroke: var(--accent-ink);
		stroke-width: 1.3;
		stroke-dasharray: 2.2 1.6;
	}

	.word {
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.two {
		color: var(--accent-text);
	}
</style>
