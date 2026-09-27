<script lang="ts">
	import { ComputerIcon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { theme } from '$lib/state/theme.svelte';

	const labels = { system: 'Match system', light: 'Light', dark: 'Dark' } as const;
</script>

<button
	type="button"
	class="btn btn-ghost btn-icon"
	onclick={() => theme.cycle()}
	title={labels[theme.choice]}
	aria-label={`Appearance: ${labels[theme.choice]}. Click to change.`}
>
	{#if theme.choice === 'system'}
		<Icon icon={ComputerIcon} size={16} />
	{:else if theme.choice === 'light'}
		<Icon icon={Sun03Icon} size={16} />
	{:else}
		<Icon icon={Moon02Icon} size={16} />
	{/if}
</button>
