<script lang="ts">
	import {
		ArrowRight02Icon,
		SquareLock02Icon,
		UserIcon,
		LockIcon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import { hasAccounts } from '$lib/core/auth';
	import { session } from '$lib/state/session.svelte';

	let mode = $state<'signin' | 'register'>('register');
	let username = $state('');
	let password = $state('');
	let remember = $state(true);
	let checked = $state(false);

	$effect(() => {
		if (checked) return;
		void hasAccounts().then((exists) => {
			mode = exists ? 'signin' : 'register';
			checked = true;
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (mode === 'register') await session.register(username, password, remember);
		else await session.login(username, password, remember);
	}

	function swap() {
		mode = mode === 'signin' ? 'register' : 'signin';
		session.error = '';
	}
</script>

<form class="w-full max-w-sm" onsubmit={submit}>
	<h2 class="text-lg font-semibold tracking-tight text-ink">
		{mode === 'signin' ? 'Sign in' : 'Create a workspace'}
	</h2>
	<p class="mt-1 mb-5 text-[0.8125rem] leading-relaxed text-ink-2">
		{mode === 'signin'
			? 'Open the projects saved under your name on this computer.'
			: 'Pick a name and a passphrase to keep your projects separate from anyone else who uses this browser.'}
	</p>

	<div class="grid gap-3">
		<div>
			<label class="label" for="auth-name">Name</label>
			<div class="with-icon">
				<Icon icon={UserIcon} size={15} class="field-icon" />
				<input
					id="auth-name"
					class="field"
					bind:value={username}
					autocomplete="username"
					placeholder="ines.moreau"
					required
				/>
			</div>
		</div>
		<div>
			<label class="label" for="auth-pass">Passphrase</label>
			<div class="with-icon">
				<Icon icon={LockIcon} size={15} class="field-icon" />
				<input
					id="auth-pass"
					class="field"
					type="password"
					bind:value={password}
					autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
					placeholder="At least 6 characters"
					required
				/>
			</div>
		</div>
		<label class="flex items-center gap-2 text-[0.8125rem] text-ink-2">
			<input type="checkbox" bind:checked={remember} class="size-3.5 accent-accent" />
			Stay signed in on this computer
		</label>
	</div>

	{#if session.error}
		<p
			class="mt-3 rounded-[var(--radius-control)] border border-danger-line bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger"
			role="alert"
		>
			{session.error}
		</p>
	{/if}

	<button class="btn btn-primary mt-5 w-full py-2.5" type="submit" disabled={session.busy}>
		{session.busy ? 'Working' : mode === 'signin' ? 'Sign in' : 'Create workspace'}
		<Icon icon={ArrowRight02Icon} size={15} strokeWidth={2} />
	</button>

	<button type="button" class="btn btn-ghost mt-2 w-full" onclick={swap}>
		{mode === 'signin' ? 'Create a new workspace instead' : 'I already have a workspace'}
	</button>

	<p class="mt-6 flex gap-2 text-xs leading-relaxed text-ink-3">
		<Icon icon={SquareLock02Icon} size={14} class="mt-0.5 shrink-0" />
		<span>
			Accounts live in this browser only. They keep projects apart on a shared machine, they do not
			encrypt the data on disk.
		</span>
	</p>
</form>

<style>
	.with-icon {
		position: relative;
	}

	.with-icon :global(.field-icon) {
		position: absolute;
		top: 50%;
		left: 0.7rem;
		transform: translateY(-50%);
		color: var(--text-3);
		pointer-events: none;
	}

	.with-icon .field {
		padding-left: 2.1rem;
	}
</style>
