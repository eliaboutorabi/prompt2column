<script module lang="ts">
	import type { IconSvgElement } from '@hugeicons/svelte';

	export interface SelectOption {
		value: string;
		label: string;
		/** Quiet text on the right of the option, like a model's size. */
		hint?: string;
		icon?: IconSvgElement;
		/** Small tags after the label, like a model's capabilities. */
		badges?: string[];
	}
</script>

<script lang="ts">
	import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		value?: string;
		options: SelectOption[];
		/** Shown when no option matches the value. */
		placeholder?: string;
		/** Icon at the start, saying what the list chooses. */
		icon?: IconSvgElement;
		/** Toolbar size. */
		compact?: boolean;
		/** Fill the width of its container. */
		block?: boolean;
		/** "field" looks like an input; "ghost" is bare text, for use inside another control. */
		variant?: 'field' | 'ghost';
		disabled?: boolean;
		id?: string;
		/** Accessible name when there is no <label for> pointing at it. */
		label?: string;
		class?: string;
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		options,
		placeholder = 'Choose',
		icon,
		compact = false,
		block = false,
		variant = 'field',
		disabled = false,
		id,
		label,
		class: className = '',
		onchange
	}: Props = $props();

	const uid = Math.random().toString(36).slice(2, 9);
	const listId = `listbox-${uid}`;
	const optionId = (index: number) => `${listId}-${index}`;
	const ROW = 34;

	let trigger = $state<HTMLButtonElement | null>(null);
	let list = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let active = $state(-1);
	let typed = '';
	let typedTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedIndex = $derived(options.findIndex((option) => option.value === value));
	const selected = $derived(selectedIndex === -1 ? undefined : options[selectedIndex]);

	/**
	 * The list lives in the top layer (the popover API), so no scrolling panel can
	 * clip it; it is placed against the trigger by hand and flips upward when
	 * there isn't room below.
	 */
	function place(height = list?.scrollHeight || options.length * ROW + 10) {
		if (!trigger || !list) return;
		const box = trigger.getBoundingClientRect();
		const below = window.innerHeight - box.bottom - 12;
		const above = box.top - 12;
		const wanted = Math.min(height, 320);
		const up = below < wanted && above > below;
		const room = Math.max(120, Math.min(320, up ? above : below));
		const width = Math.max(box.width, variant === 'ghost' ? 200 : 0);
		const left = Math.min(Math.max(8, box.left), window.innerWidth - width - 8);
		list.style.minWidth = `${width}px`;
		list.style.left = `${left}px`;
		list.style.maxHeight = `${room}px`;
		list.style.top = up ? 'auto' : `${box.bottom + 5}px`;
		list.style.bottom = up ? `${window.innerHeight - box.top + 5}px` : 'auto';
		list.style.transformOrigin = up ? 'bottom' : 'top';
	}

	function show() {
		if (disabled || !list || open) return;
		active = selectedIndex === -1 ? 0 : selectedIndex;
		list.showPopover();
	}

	function hide() {
		if (list?.matches(':popover-open')) list.hidePopover();
	}

	function choose(index: number) {
		const option = options[index];
		if (!option) return;
		hide();
		trigger?.focus();
		if (option.value === value) return;
		value = option.value;
		onchange?.(option.value);
	}

	function move(to: number) {
		if (!options.length) return;
		active = Math.max(0, Math.min(options.length - 1, to));
		list?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	}

	function onKeydown(event: KeyboardEvent) {
		if (disabled) return;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) show();
				else move(active + 1);
				return;
			case 'ArrowUp':
				event.preventDefault();
				if (!open) show();
				else move(active - 1);
				return;
			case 'Home':
			case 'End':
				if (!open) return;
				event.preventDefault();
				move(event.key === 'Home' ? 0 : options.length - 1);
				return;
			case 'Enter':
			case ' ':
				event.preventDefault();
				if (open) choose(active);
				else show();
				return;
			case 'Tab':
				hide();
				return;
		}
		// Type-ahead: jump to the option that starts with what was typed.
		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
			typed += event.key.toLowerCase();
			clearTimeout(typedTimer);
			typedTimer = setTimeout(() => (typed = ''), 600);
			const start = open ? active : selectedIndex;
			const order = [...options.keys()].map((i) => (i + start + 1) % options.length);
			const hit = order.find((i) => options[i].label.toLowerCase().startsWith(typed));
			if (hit === undefined) return;
			if (open) move(hit);
			else choose(hit);
		}
	}

	// Keep state in step with the popover, and follow the page while it's open.
	$effect(() => {
		const element = list;
		if (!element) return;
		const beforeToggle = (event: Event) => {
			if ((event as ToggleEvent).newState === 'open') place();
		};
		const toggle = (event: Event) => {
			open = (event as ToggleEvent).newState === 'open';
			if (open) {
				place();
				move(active);
			}
		};
		const onScroll = (event: Event) => {
			if (open && event.target instanceof Node && !element.contains(event.target)) hide();
		};
		const onResize = () => open && place();
		element.addEventListener('beforetoggle', beforeToggle);
		element.addEventListener('toggle', toggle);
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onResize);
		return () => {
			element.removeEventListener('beforetoggle', beforeToggle);
			element.removeEventListener('toggle', toggle);
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onResize);
			clearTimeout(typedTimer);
		};
	});
</script>

<!-- Variant classes are prefixed so they can't pick up the global .field input style. -->
<span class={['select', `is-${variant}`, compact && 'is-compact', block && 'is-block', className]}>
	<button
		bind:this={trigger}
		type="button"
		class="trigger"
		{id}
		role="combobox"
		aria-label={label}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listId}
		aria-activedescendant={open && active !== -1 ? optionId(active) : undefined}
		popovertarget={listId}
		{disabled}
		onkeydown={onKeydown}
	>
		{#if icon}
			<Icon {icon} size={compact ? 13 : 15} class="lead" />
		{/if}
		{#if selected?.icon && !icon}
			<Icon icon={selected.icon} size={compact ? 13 : 15} class="lead" />
		{/if}
		<span class={['current', !selected && 'placeholder']}>{selected?.label ?? placeholder}</span>
		{#if selected?.hint && variant === 'field' && !compact}
			<span class="current-hint">{selected.hint}</span>
		{/if}
		<Icon
			icon={ArrowDown01Icon}
			size={compact ? 11 : 12}
			strokeWidth={2}
			class={open ? 'chevron open' : 'chevron'}
		/>
	</button>

	<div bind:this={list} id={listId} class="list" popover="auto" role="listbox" tabindex="-1">
		{#each options as option, index (option.value)}
			<!-- Focus stays on the trigger (aria-activedescendant); options take pointer input only. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				id={optionId(index)}
				role="option"
				tabindex="-1"
				aria-selected={option.value === value}
				class={['option', index === active && 'active']}
				onpointermove={() => (active = index)}
				onmousedown={(event) => event.preventDefault()}
				onclick={() => choose(index)}
			>
				{#if option.icon}
					<Icon icon={option.icon} size={15} class="option-icon" />
				{/if}
				<span class="option-label">{option.label}</span>
				{#each option.badges ?? [] as badge (badge)}
					<span class="badge">{badge}</span>
				{/each}
				{#if option.hint}
					<span class="option-hint">{option.hint}</span>
				{/if}
				<span class="check">
					{#if option.value === value}
						<Icon icon={Tick02Icon} size={14} strokeWidth={2} />
					{/if}
				</span>
			</div>
		{:else}
			<div class="empty">Nothing to choose from.</div>
		{/each}
	</div>
</span>

<style>
	.select {
		position: relative;
		display: inline-flex;
		min-width: 0;
	}

	.select.is-block {
		display: flex;
		width: 100%;
	}

	.trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		height: 2.25rem;
		padding: 0 0.7rem;
		border-radius: var(--radius-control);
		font-size: 0.8125rem;
		color: var(--text);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--dur-fast) ease,
			background-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.is-field .trigger {
		background: var(--surface);
		border: 1px solid var(--line-strong);
		box-shadow: var(--elev-1);
	}

	.is-field .trigger:hover:not(:disabled) {
		border-color: color-mix(in oklch, var(--text-3) 70%, var(--line-strong));
	}

	.is-field .trigger:focus-visible,
	.is-field .trigger[aria-expanded='true'] {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--ring);
	}

	.is-compact .trigger {
		height: 1.9rem;
		padding: 0 0.55rem;
		font-size: 0.75rem;
	}

	/* Bare text with a chevron, for tucking inside another control. */
	.is-ghost .trigger {
		height: 1.6rem;
		padding: 0 0.4rem;
		border-radius: 6px;
		color: var(--text-3);
		font-size: 0.75rem;
	}

	.is-ghost .trigger:hover:not(:disabled),
	.is-ghost .trigger[aria-expanded='true'] {
		background: var(--surface-3);
		color: var(--text);
	}

	.trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.trigger :global(.lead) {
		color: var(--text-3);
	}

	.current {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.is-ghost .current {
		max-width: 9rem;
	}

	.placeholder {
		color: var(--text-3);
	}

	.current-hint {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.trigger :global(.chevron) {
		flex-shrink: 0;
		color: var(--text-3);
		transition: transform var(--dur) var(--ease-out);
	}

	.trigger :global(.chevron.open) {
		transform: rotate(180deg);
	}

	/* The list, in the top layer. */
	.list {
		position: fixed;
		inset: auto;
		margin: 0;
		max-width: min(24rem, calc(100vw - 16px));
		padding: 0.3rem;
		overflow-y: auto;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pop);
	}

	.list:popover-open {
		animation: pop-in var(--dur) var(--ease-out);
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.05rem;
		padding: 0.35rem 0.55rem;
		border-radius: 7px;
		font-size: 0.8125rem;
		cursor: pointer;
		user-select: none;
	}

	.option.active {
		background: var(--surface-2);
	}

	.option[aria-selected='true'] {
		font-weight: 500;
	}

	.option :global(.option-icon) {
		color: var(--text-3);
	}

	.option-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		flex-shrink: 0;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--surface-3);
		font-size: 0.625rem;
		font-weight: 500;
		line-height: 1.1rem;
		color: var(--text-2);
	}

	.option-hint {
		flex-shrink: 0;
		margin-left: auto;
		padding-left: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.check {
		display: grid;
		place-items: center;
		width: 1rem;
		flex-shrink: 0;
		margin-left: auto;
		color: var(--accent-text);
	}

	.option-hint + .check {
		margin-left: 0.25rem;
	}

	.empty {
		padding: 0.6rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}
</style>
