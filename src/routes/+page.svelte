<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ArrowRight02Icon,
		Delete02Icon,
		LayoutTable01Icon,
		Logout03Icon
	} from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';
	import Brand from '$lib/components/Brand.svelte';
	import AuthPanel from '$lib/components/AuthPanel.svelte';
	import ImportPanel from '$lib/components/ImportPanel.svelte';
	import TemplateHighlight from '$lib/components/TemplateHighlight.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { session } from '$lib/state/session.svelte';
	import type { Column, Project } from '$lib/core/types';

	$effect(() => {
		void session.init();
	});

	const demoColumns: Column[] = [
		{ id: 'c1', name: 'Customer', generated: false },
		{ id: 'c2', name: 'Message', generated: false }
	];
	const demoTemplate = 'Classify this ticket.\n\nFrom: {{Customer}}\nText: {{Message}}';
	const demoRows = [
		{ who: 'Bilal Haddad', text: 'Billing charged us twice in March.', label: 'billing' },
		{ who: 'Freya Lindqvist', text: 'The audit log has been solid.', label: 'praise' },
		{ who: 'Sanne de Vries', text: 'Login link never arrives.', label: 'access' }
	];

	const formatDate = (value: number) =>
		new Intl.DateTimeFormat(undefined, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(value);

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
		<main
			class="mx-auto grid max-w-[1180px] gap-12 px-5 py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:py-20"
		>
			<div>
				<h1
					class="max-w-[18ch] text-4xl leading-[1.05] font-semibold tracking-tight text-ink md:text-5xl"
				>
					Fill a spreadsheet column with a prompt.
				</h1>
				<p class="mt-5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">
					Point at the columns you already have, say what the new one should hold, and a model on
					your own machine writes it row by row.
				</p>

				<div class="panel mt-10 overflow-hidden">
					<div class="border-b border-line px-4 py-3">
						<pre class="demo-prompt"><TemplateHighlight
								value={demoTemplate}
								columns={demoColumns}
								pad={false}
							/></pre>
					</div>
					<table class="w-full text-left">
						<thead>
							<tr class="text-[0.6875rem] text-ink-3">
								<th class="px-4 py-1.5 font-medium">Customer</th>
								<th class="px-4 py-1.5 font-medium">Message</th>
								<th class="bg-accent-soft px-4 py-1.5 font-medium text-accent-text">Topic</th>
							</tr>
						</thead>
						<tbody class="text-[0.8125rem] text-ink">
							{#each demoRows as row (row.who)}
								<tr class="border-t border-line">
									<td class="px-4 py-2 whitespace-nowrap text-ink-2">{row.who}</td>
									<td class="max-w-[24ch] truncate px-4 py-2">{row.text}</td>
									<td class="bg-accent-soft px-4 py-2 font-mono text-xs text-accent-text">
										{row.label}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<p class="mt-4 text-xs text-ink-3">
					Requires Ollama running locally. Nothing is sent to a server.
				</p>
			</div>

			<div class="panel h-fit p-6 lg:p-8" style="box-shadow: var(--shadow-panel)">
				<AuthPanel />
			</div>
		</main>
	{:else}
		<main class="mx-auto grid max-w-[1180px] gap-10 px-5 py-10 lg:px-8">
			<section>
				<h1 class="text-xl font-semibold tracking-tight text-ink">Start a project</h1>
				<p class="mt-1 mb-5 text-[0.8125rem] text-ink-2">
					Import a sheet, then build the column you need.
				</p>
				<ImportPanel onCreated={open} />
			</section>

			{#if session.projects.length}
				<section>
					<h2 class="mb-3 text-sm font-semibold tracking-tight text-ink">Your projects</h2>
					<ul class="grid gap-2">
						{#each session.projects as project (project.id)}
							<li class="project">
								<button class="project-open" onclick={() => open(project)}>
									<span class="project-icon"><Icon icon={LayoutTable01Icon} size={17} /></span>
									<span class="project-text">
										<span class="truncate text-[0.9375rem] font-medium text-ink"
											>{project.name}</span
										>
										<span class="font-mono text-xs text-ink-3">
											{project.rowCount} rows, {project.columnCount} columns, saved {formatDate(
												project.updatedAt
											)}
										</span>
									</span>
								</button>
								{#if pendingDelete === project.id}
									<div class="flex items-center gap-1.5">
										<button
											class="btn btn-outline border-danger-line text-danger"
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
									<div class="flex items-center gap-1">
										<button
											class="btn btn-ghost px-2"
											aria-label={`Delete ${project.name}`}
											onclick={() => (pendingDelete = project.id)}
										>
											<Icon icon={Delete02Icon} size={15} />
										</button>
										<button
											class="btn btn-ghost px-2"
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

	.demo-prompt {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.6;
		white-space: pre-wrap;
		color: var(--text);
		margin: 0;
	}

	.project {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0.7rem 0.6rem 0.9rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		transition: border-color 0.14s ease;
	}

	.project:hover {
		border-color: var(--line-strong);
	}

	.project-open {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		text-align: left;
	}

	.project-icon {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: var(--radius-control);
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.project-text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
</style>
