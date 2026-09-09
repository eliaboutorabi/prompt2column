<script lang="ts">
	import { tick } from 'svelte';
	import TemplateHighlight from './TemplateHighlight.svelte';
	import { autocompleteContext, insertReference, rankColumns } from '$lib/core/template';
	import type { Column } from '$lib/core/types';

	interface Props {
		value: string;
		columns: Column[];
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		rows?: number;
	}

	let {
		value = $bindable(''),
		columns,
		placeholder = '',
		id = 'prompt-editor',
		disabled = false,
		rows = 8
	}: Props = $props();

	let textarea = $state<HTMLTextAreaElement | null>(null);
	let overlay = $state<HTMLDivElement | null>(null);
	let shell = $state<HTMLDivElement | null>(null);

	let open = $state(false);
	let matches = $state<Column[]>([]);
	let activeIndex = $state(0);
	let caretLeft = $state(0);
	let caretTop = $state(0);

	const listId = $derived(`${id}-suggestions`);

	/** Places the popup under the caret using a hidden copy of the textarea. */
	function caretOffset(element: HTMLTextAreaElement, index: number) {
		const style = getComputedStyle(element);
		const mirror = document.createElement('div');
		const copied = [
			'boxSizing',
			'width',
			'paddingTop',
			'paddingRight',
			'paddingBottom',
			'paddingLeft',
			'borderTopWidth',
			'borderRightWidth',
			'borderBottomWidth',
			'borderLeftWidth',
			'fontFamily',
			'fontSize',
			'fontWeight',
			'letterSpacing',
			'lineHeight',
			'textTransform',
			'wordSpacing',
			'tabSize'
		] as const;
		for (const property of copied) mirror.style[property] = style[property];
		mirror.style.position = 'absolute';
		mirror.style.top = '0';
		mirror.style.left = '-9999px';
		mirror.style.visibility = 'hidden';
		mirror.style.whiteSpace = 'pre-wrap';
		mirror.style.overflowWrap = 'break-word';
		mirror.textContent = element.value.slice(0, index);
		const marker = document.createElement('span');
		marker.textContent = '.';
		mirror.append(marker);
		document.body.append(mirror);
		const offset = { left: marker.offsetLeft, top: marker.offsetTop };
		mirror.remove();
		return offset;
	}

	function syncSuggestions() {
		if (!textarea || disabled) return;
		const caret = textarea.selectionStart ?? 0;
		const context = autocompleteContext(value, caret);
		if (!context) {
			open = false;
			return;
		}
		const ranked = rankColumns(columns, context.query);
		matches = ranked.slice(0, 8);
		open = matches.length > 0;
		if (!open) return;
		activeIndex = Math.min(activeIndex, matches.length - 1);
		const offset = caretOffset(textarea, context.start);
		const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
		const maxLeft = Math.max(0, textarea.clientWidth - 236);
		caretLeft = Math.min(offset.left, maxLeft);
		caretTop = offset.top + lineHeight - textarea.scrollTop;
	}

	async function apply(column: Column) {
		if (!textarea) return;
		const caret = textarea.selectionStart ?? value.length;
		const next = insertReference(value, caret, column.name);
		value = next.text;
		open = false;
		activeIndex = 0;
		await tick();
		textarea.focus();
		textarea.setSelectionRange(next.caret, next.caret);
	}

	/** Used by the grid and the column palette to drop a reference at the caret. */
	export async function insertColumn(column: Column) {
		if (!textarea) {
			value = insertReference(value, value.length, column.name).text;
			return;
		}
		await apply(column);
	}

	export function focus() {
		textarea?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) {
			if (event.key === '@' || (event.ctrlKey && event.key === ' ')) {
				event.preventDefault();
				void openPalette();
			}
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % matches.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + matches.length) % matches.length;
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			void apply(matches[activeIndex]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	/** Typing "@" is a shortcut for opening a reference. */
	async function openPalette() {
		if (!textarea) return;
		const caret = textarea.selectionStart ?? value.length;
		value = `${value.slice(0, caret)}{{}}${value.slice(caret)}`;
		await tick();
		textarea.focus();
		textarea.setSelectionRange(caret + 2, caret + 2);
		activeIndex = 0;
		syncSuggestions();
	}

	function onScroll() {
		if (!overlay || !textarea) return;
		overlay.scrollTop = textarea.scrollTop;
		overlay.scrollLeft = textarea.scrollLeft;
	}
</script>

<div class="shell" bind:this={shell}>
	<div class="layer overlay" bind:this={overlay} aria-hidden="true">
		<TemplateHighlight {value} {columns} />
	</div>
	<textarea
		{id}
		{rows}
		{placeholder}
		{disabled}
		class="layer input"
		spellcheck="false"
		bind:this={textarea}
		bind:value
		oninput={syncSuggestions}
		onclick={syncSuggestions}
		onkeyup={(event) => {
			if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) syncSuggestions();
		}}
		onkeydown={onKeydown}
		onscroll={onScroll}
		onblur={() => setTimeout(() => (open = false), 120)}
		role="combobox"
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="list"></textarea>

	{#if open}
		<ul
			class="popup"
			id={listId}
			role="listbox"
			style="left:{caretLeft}px; top:{caretTop}px"
			aria-label="Columns"
		>
			{#each matches as column, index (column.id)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={index === activeIndex}
						class="option"
						class:active={index === activeIndex}
						onmousedown={(event) => event.preventDefault()}
						onclick={() => apply(column)}
						onmouseenter={() => (activeIndex = index)}
					>
						<span class="name">{column.name}</span>
						{#if column.generated}<span class="badge">generated</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.shell {
		position: relative;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		background: var(--surface);
		transition: border-color 0.14s ease;
	}

	.shell:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.layer {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.55;
		padding: 0.6rem 0.7rem;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		margin: 0;
		border: 0;
	}

	.overlay {
		position: absolute;
		inset: 0;
		overflow: hidden;
		color: var(--text);
		pointer-events: none;
	}

	.input {
		position: relative;
		display: block;
		width: 100%;
		resize: vertical;
		background: transparent;
		color: transparent;
		caret-color: var(--text);
		outline: none;
		min-height: 6rem;
	}

	.input::placeholder {
		color: var(--text-3);
	}

	.popup {
		position: absolute;
		z-index: 30;
		min-width: 12rem;
		max-width: 15rem;
		padding: 0.25rem;
		margin: 0;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pop);
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.3rem 0.45rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		text-align: left;
		color: var(--text);
	}

	.option.active {
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
</style>
