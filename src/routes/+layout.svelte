<script lang="ts">
	import './layout.css';
	import '@fontsource-variable/geist';
	import '@fontsource-variable/geist-mono';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/state/theme.svelte';

	let { children } = $props();

	$effect(() => theme.init());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="color-scheme" content="light dark" />
</svelte:head>

{@render children()}
