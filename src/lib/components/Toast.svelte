<script lang="ts">
	import { CheckmarkCircle02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { toast } from '$lib/state/toast.svelte';
</script>

<!-- Always in the DOM so screen readers are listening before anything is announced. -->
<div class="region" role="status" aria-live="polite">
	{#if toast.current}
		{#key toast.current.id}
			<div class="toast">
				<Icon
					icon={toast.current.tone === 'success' ? CheckmarkCircle02Icon : InformationCircleIcon}
					size={16}
					class="toast-icon"
				/>
				<span>{toast.current.message}</span>
			</div>
		{/key}
	{/if}
</div>

<style>
	.region {
		position: fixed;
		bottom: 1.25rem;
		left: 50%;
		z-index: 60;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.toast {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		max-width: min(28rem, calc(100vw - 2rem));
		padding: 0.6rem 0.9rem 0.6rem 0.75rem;
		border-radius: 999px;
		background: var(--text);
		color: var(--canvas);
		font-size: 0.8125rem;
		font-weight: 500;
		box-shadow: var(--shadow-pop);
		animation: rise-in 240ms var(--ease-out);
	}

	.toast span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.toast :global(.toast-icon) {
		color: var(--accent);
	}
</style>
