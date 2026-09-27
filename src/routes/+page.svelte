<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		AiMagicIcon,
		ArrowRight02Icon,
		CheckmarkBadge01Icon,
		Delete02Icon,
		GridTableIcon,
		LayoutTable01Icon,
		Logout03Icon,
		SquareLock02Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import Brand from '$lib/components/Brand.svelte';
	import AuthPanel from '$lib/components/AuthPanel.svelte';
	import ImportPanel from '$lib/components/ImportPanel.svelte';
	import TemplateHighlight from '$lib/components/TemplateHighlight.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { session } from '$lib/state/session.svelte';
	import { labelTone } from '$lib/core/columns';
	import type { Column, Project } from '$lib/core/types';

	$effect(() => {
		void session.init();
	});

	// Signing in swaps the whole page; start the new one at the top instead of
	// wherever the sign-in form had been scrolled to (below the hero on phones).
	let lastAccount: string | null = null;
	$effect(() => {
		const id = session.account?.id ?? null;
		if (id !== lastAccount) window.scrollTo({ top: 0 });
		lastAccount = id;
	});

	const demoColumns: Column[] = [
		{ id: 'c1', name: 'Customer', generated: false },
		{ id: 'c2', name: 'Message', generated: false }
	];
	const demoTemplate =
		'Classify the sentiment of this ticket.\n\nFrom: {{Customer}}\nText: {{Message}}';
	const demoRows = [
		{ who: 'Bilal Haddad', text: 'Billing charged us twice in March.', label: 'negative' },
		{ who: 'Freya Lindqvist', text: 'The audit log has been solid.', label: 'positive' },
		{ who: 'Amara Okonkwo', text: 'How do I move a project?', label: 'neutral' },
		{ who: 'Sanne de Vries', text: 'Login link never arrives.', label: 'negative' }
	];

	const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

	function savedAgo(timestamp: number): string {
		const seconds = Math.round((timestamp - Date.now()) / 1000);
		if (seconds > -60) return 'just now';
		const minutes = Math.round(seconds / 60);
		if (minutes > -60) return relative.format(minutes, 'minute');
		const hours = Math.round(minutes / 60);
		if (hours > -24) return relative.format(hours, 'hour');
		return relative.format(Math.round(hours / 24), 'day');
	}

	function greeting(): string {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return 'Good morning';
		if (hour >= 12 && hour < 18) return 'Good afternoon';
		return 'Good evening';
	}

	/** "ines.moreau" reads as "Ines". */
	function firstName(username: string): string {
		const first = username.split(/[.\s_-]/)[0] || username;
		return first.charAt(0).toUpperCase() + first.slice(1);
	}

	function open(project: Project | { id: string }) {
		void goto(resolve(`/app?p=${project.id}`));
	}

	let pendingDelete = $state<string | null>(null);
</script>

<svelte:head>
	<title>prompt2column</title>
	<meta
		name="description"
		content="Add a column to a spreadsheet by writing one prompt. Runs on your own machine through Ollama."
	/>
</svelte:head>

<div class="min-h-[100dvh]">
	<header class="topbar">
		<a href={resolve('/')} class="home-link" aria-label="prompt2column home">
			<Brand />
		</a>
		<div class="flex items-center gap-1">
			{#if session.account}
				<span class="user" title={`Signed in as ${session.account.username}`}>
					<span class="avatar" aria-hidden="true">
						{session.account.username.slice(0, 1).toUpperCase()}
					</span>
					<span class="user-name">{session.account.username}</span>
				</span>
				<button
					class="btn btn-ghost btn-icon"
					title="Sign out"
					aria-label="Sign out"
					onclick={() => session.signOut()}
				>
					<Icon icon={Logout03Icon} size={16} />
				</button>
			{/if}
			<ThemeToggle />
		</div>
	</header>

	{#if !session.ready}
		<div class="grid place-items-center py-32 text-sm text-ink-3">Opening your workspace</div>
	{:else if !session.account}
		<main class="welcome">
			<div class="glow" aria-hidden="true"></div>
			<div class="hero">
				<span class="pill">
					<Icon icon={SquareLock02Icon} size={13} />
					Runs on your machine with Ollama
				</span>
				<h1 class="headline">Fill a spreadsheet column <span class="lit">with a prompt.</span></h1>
				<p class="lead">
					Point at the columns you have, describe the new one, and a model on your own machine fills
					it in, row by row.
				</p>

				<div class="demo">
					<div class="demo-prompt-wrap">
						<span class="demo-label"><Icon icon={AiMagicIcon} size={13} /> Prompt</span>
						<pre class="demo-prompt"><TemplateHighlight
								value={demoTemplate}
								columns={demoColumns}
								pad={false}
							/></pre>
					</div>
					<table class="demo-table">
						<thead>
							<tr>
								<th>Customer</th>
								<th>Message</th>
								<th class="gen"><Icon icon={AiMagicIcon} size={12} /> Sentiment</th>
							</tr>
						</thead>
						<tbody>
							{#each demoRows as row (row.who)}
								<tr>
									<td class="who">{row.who}</td>
									<td class="text">{row.text}</td>
									<td class="gen">
										<span class="tag tone-{labelTone(row.label)}">{row.label}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<ul class="facts">
					<li><Icon icon={SquareLock02Icon} size={15} /> Nothing leaves your computer</li>
					<li><Icon icon={CheckmarkBadge01Icon} size={15} /> Answers in the shape you choose</li>
					<li><Icon icon={GridTableIcon} size={15} /> CSV in, CSV or JSON out</li>
				</ul>
			</div>

			<div class="auth-card">
				<AuthPanel />
			</div>
		</main>
	{:else}
		<main class="dash">
			<div class="dash-head">
				<h1 class="dash-title">{greeting()}, {firstName(session.account.username)}</h1>
				<p class="dash-sub">
					{session.projects.length
						? 'Pick up where you left off, or start something new.'
						: 'Import a sheet to get started.'}
				</p>
			</div>

			{#if session.projects.length}
				<section>
					<div class="section-head">
						<h2 class="section-title">Your projects</h2>
						<span class="section-count">{session.projects.length}</span>
					</div>
					<ul class="projects">
						{#each session.projects as project (project.id)}
							<li class="card" class:confirming={pendingDelete === project.id}>
								<button class="card-open" onclick={() => open(project)}>
									<span class="card-top">
										<span class="card-icon"><Icon icon={LayoutTable01Icon} size={18} /></span>
										{#if project.generatedCount}
											<span class="card-badge">
												<Icon icon={AiMagicIcon} size={11} />
												{project.generatedCount} generated
											</span>
										{/if}
									</span>
									<span class="card-name">{project.name}</span>
									<span class="card-cols">
										{#each project.columnNames.slice(0, 4) as name (name)}
											<span class="col">{name}</span>
										{/each}
										{#if project.columnCount > 4}
											<span class="col more">+{project.columnCount - 4}</span>
										{/if}
									</span>
									<span class="card-meta">
										{project.rowCount} rows, {project.columnCount} columns · Saved {savedAgo(
											project.updatedAt
										)}
									</span>
								</button>
								{#if pendingDelete === project.id}
									<div class="confirm">
										<span>Delete this project?</span>
										<button
											class="btn btn-outline danger"
											onclick={async () => {
												await session.removeProject(project.id);
												pendingDelete = null;
											}}
										>
											Delete for good
										</button>
										<button class="btn btn-ghost" onclick={() => (pendingDelete = null)}>
											Keep
										</button>
									</div>
								{:else}
									<div class="card-actions">
										<button
											class="btn btn-ghost btn-icon"
											title="Delete"
											aria-label={`Delete ${project.name}`}
											onclick={() => (pendingDelete = project.id)}
										>
											<Icon icon={Delete02Icon} size={15} />
										</button>
										<button
											class="btn btn-ghost btn-icon"
											title="Open"
											onclick={() => open(project)}
											aria-label={`Open ${project.name}`}
										>
											<Icon icon={ArrowRight02Icon} size={15} />
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section>
				<div class="section-head">
					<h2 class="section-title">Start a project</h2>
				</div>
				<ImportPanel onCreated={open} />
			</section>
		</main>
	{/if}
</div>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.5rem;
		padding: 0 0.9rem 0 1.25rem;
		border-bottom: 1px solid var(--line);
		background: color-mix(in oklch, var(--surface) 70%, transparent);
	}

	.home-link {
		display: flex;
		align-items: center;
		border-radius: 8px;
	}

	.user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-right: 0.35rem;
		font-size: 0.8125rem;
		color: var(--text-2);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-text);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.user-name {
		display: none;
	}

	@media (min-width: 640px) {
		.user-name {
			display: inline;
		}
	}

	/* Signed out: the promise, a live preview, and the way in. */
	.welcome {
		position: relative;
		display: grid;
		gap: 3rem;
		max-width: 1180px;
		margin: 0 auto;
		padding: 3rem 1.25rem 4rem;
		isolation: isolate;
	}

	@media (min-width: 1024px) {
		.welcome {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
			align-items: start;
			gap: 4.5rem;
			padding: 4.5rem 2rem 5rem;
		}
	}

	/* One soft light behind the hero, in the accent. Not a gradient wash. */
	.glow {
		position: absolute;
		inset: -6rem auto auto -8rem;
		z-index: -1;
		width: 38rem;
		height: 30rem;
		border-radius: 999px;
		background: radial-gradient(
			closest-side,
			color-mix(in oklch, var(--accent) 22%, transparent),
			transparent
		);
		filter: blur(20px);
		opacity: 0.8;
		pointer-events: none;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 1.75rem;
		padding: 0 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: color-mix(in oklch, var(--surface) 80%, transparent);
		font-size: 0.75rem;
		color: var(--text-2);
		box-shadow: var(--elev-1);
	}

	.headline {
		max-width: 16ch;
		margin-top: 1.25rem;
		font-size: clamp(2.25rem, 4.6vw, 3.5rem);
		line-height: 1.02;
		font-weight: 650;
		letter-spacing: -0.035em;
		color: var(--text);
	}

	.lit {
		color: var(--accent-text);
	}

	.lead {
		max-width: 44ch;
		margin-top: 1.1rem;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-2);
	}

	.demo {
		margin-top: 2.25rem;
		overflow: hidden;
		border-radius: var(--radius-large);
		border: 1px solid var(--line);
		background: var(--surface);
		box-shadow: var(--shadow-panel);
	}

	.demo-prompt-wrap {
		padding: 0.85rem 1rem 0.9rem;
		border-bottom: 1px solid var(--line);
	}

	.demo-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--accent-text);
	}

	.demo-prompt {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.65;
		white-space: pre-wrap;
		color: var(--text);
	}

	.demo-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.8125rem;
	}

	.demo-table th {
		padding: 0.45rem 1rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-3);
		background: var(--surface-2);
	}

	.demo-table th.gen {
		color: var(--accent-text);
	}

	.demo-table th.gen :global(.hi) {
		display: inline;
		vertical-align: -2px;
		margin-right: 0.2rem;
	}

	.demo-table td {
		padding: 0.5rem 1rem;
		border-top: 1px solid var(--line);
		color: var(--text);
	}

	.demo-table .who {
		white-space: nowrap;
		color: var(--text-2);
	}

	.demo-table .text {
		max-width: 22ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.demo-table td.gen {
		background: color-mix(in oklch, var(--accent-soft) 40%, transparent);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.4rem;
		margin-top: 1.5rem;
		font-size: 0.8125rem;
		color: var(--text-2);
	}

	.facts li {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.facts :global(.hi) {
		color: var(--accent-text);
	}

	.auth-card {
		padding: 1.75rem;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
	}

	@media (min-width: 1024px) {
		.auth-card {
			position: sticky;
			top: 2rem;
			margin-top: 2.5rem;
			padding: 2.25rem;
		}
	}

	/* Signed in: your work first, then ways to start something new. */
	.dash {
		display: grid;
		gap: 2.5rem;
		max-width: 1180px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
	}

	@media (min-width: 1024px) {
		.dash {
			padding: 3rem 2rem 5rem;
		}
	}

	.dash-title {
		font-size: 1.75rem;
		font-weight: 650;
		letter-spacing: -0.03em;
		color: var(--text);
	}

	.dash-sub {
		margin-top: 0.35rem;
		font-size: 0.875rem;
		color: var(--text-2);
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.85rem;
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.section-count {
		display: grid;
		place-items: center;
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-2);
	}

	.projects {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}

	.card {
		position: relative;
		border-radius: var(--radius-large);
		border: 1px solid var(--line);
		background: var(--surface);
		box-shadow: var(--elev-1);
		transition:
			border-color var(--dur) ease,
			box-shadow var(--dur) ease,
			transform var(--dur) var(--ease-out);
	}

	.card:hover {
		border-color: var(--line-strong);
		box-shadow: var(--shadow-panel);
		transform: translateY(-1px);
	}

	.card-open {
		display: grid;
		gap: 0.45rem;
		width: 100%;
		padding: 1rem 1rem 0.9rem;
		text-align: left;
		border-radius: inherit;
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.card-icon {
		display: grid;
		place-items: center;
		width: 2.3rem;
		height: 2.3rem;
		border-radius: 10px;
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.card-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.3rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: var(--accent-soft);
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--accent-text);
	}

	.card-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.card-cols {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		max-height: 3.1rem;
		overflow: hidden;
	}

	.col {
		max-width: 9rem;
		padding: 0.05rem 0.4rem;
		border-radius: 5px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		font-size: 0.6875rem;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col.more {
		color: var(--text-3);
	}

	.card-meta {
		margin-top: 0.2rem;
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	/* Delete and open wait in the corner until the card is hovered or focused. */
	.card-actions {
		position: absolute;
		top: 0.7rem;
		right: 0.6rem;
		display: flex;
		gap: 0.1rem;
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}

	.card:hover .card-actions,
	.card:focus-within .card-actions {
		opacity: 1;
	}

	@media (hover: none) {
		.card-actions {
			opacity: 1;
		}
	}

	.confirm {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		padding: 0.7rem 1rem 0.9rem;
		border-top: 1px solid var(--line);
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.confirm span {
		margin-right: auto;
	}

	.confirm .danger {
		border-color: var(--danger-line);
		color: var(--danger);
	}
</style>
