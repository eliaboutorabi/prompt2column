<script lang="ts">
	import { sidebar, SIDEBAR_MIN } from '$lib/state/sidebar.svelte';

	/** Arrow keys move this far; with Shift, four times as far. */
	const STEP = 16;

	let dragging = $state(false);
	let startX = 0;
	let startWidth = 0;

	// The sidebar sits on the left, so dragging its edge right widens it.
	function onMove(event: PointerEvent) {
		sidebar.set(startWidth + (event.clientX - startX));
	}

	function detach() {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onUp);
	}

	function onUp() {
		dragging = false;
		sidebar.save();
		detach();
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		dragging = true;
		startX = event.clientX;
		startWidth = sidebar.shown;
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	function onKeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? STEP * 4 : STEP;
		const next = {
			ArrowRight: sidebar.shown + step,
			ArrowLeft: sidebar.shown - step,
			Home: SIDEBAR_MIN,
			End: sidebar.max
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		sidebar.set(next);
		sidebar.save();
	}

	// While dragging, the whole page shows the resize cursor and text can't be selected.
	$effect(() => {
		document.documentElement.classList.toggle('resizing-sidebar', dragging);
		return () => document.documentElement.classList.remove('resizing-sidebar');
	});

	$effect(() => detach);
</script>

<!-- A window splitter: focusable, with its size as a value (WAI-ARIA separator). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class={['resizer', dragging && 'dragging']}
	role="separator"
	aria-orientation="vertical"
	aria-label="Resize sidebar"
	aria-valuemin={SIDEBAR_MIN}
	aria-valuemax={sidebar.max}
	aria-valuenow={sidebar.shown}
	aria-valuetext="{sidebar.shown} pixels wide"
	tabindex="0"
	onpointerdown={onPointerDown}
	ondblclick={() => sidebar.reset()}
	onkeydown={onKeydown}
>
	<span class="grip" aria-hidden="true"></span>
</div>

<style>
	/* A generous hit area straddling the sidebar's edge; only a hairline shows. */
	.resizer {
		position: absolute;
		top: 0;
		bottom: 0;
		right: -6px;
		z-index: 25;
		width: 10px;
		cursor: col-resize;
		touch-action: none;
	}

	.resizer::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 4px;
		width: 2px;
		background: transparent;
		transition: background-color var(--dur) ease;
	}

	.grip {
		position: absolute;
		top: 50%;
		left: 2px;
		width: 6px;
		height: 2.25rem;
		translate: 0 -50%;
		border-radius: 999px;
		background: var(--surface);
		box-shadow:
			inset 0 0 0 1px var(--line-strong),
			var(--elev-1);
		opacity: 0;
		transition: opacity var(--dur) ease;
	}

	/* A short delay before the hover state, so passing the edge on the way to the
	   sidebar doesn't flash it. */
	.resizer:hover::before,
	.resizer:hover .grip {
		transition-delay: 150ms;
	}

	.resizer:hover::before,
	.resizer:focus-visible::before {
		background: var(--accent-line);
	}

	.resizer:hover .grip,
	.resizer:focus-visible .grip,
	.dragging .grip {
		opacity: 1;
	}

	.dragging::before {
		background: var(--accent);
		transition-delay: 0ms;
	}

	.resizer:focus-visible {
		outline: none;
	}
</style>
