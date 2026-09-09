<script lang="ts">
	import { Desktop, Moon, Sun } from 'phosphor-svelte';
	import { theme } from '$lib/state/theme.svelte';

	const labels = { system: 'Match system', light: 'Light', dark: 'Dark' } as const;
</script>

<button
	type="button"
	class="btn btn-ghost px-2"
	onclick={() => theme.cycle()}
	title={labels[theme.choice]}
	aria-label={`Appearance: ${labels[theme.choice]}. Click to change.`}
>
	{#if theme.choice === 'system'}
		<Desktop size={16} weight="regular" />
	{:else if theme.choice === 'light'}
		<Sun size={16} weight="regular" />
	{:else}
		<Moon size={16} weight="regular" />
	{/if}
</button>
