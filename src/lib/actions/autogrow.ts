import type { Action } from 'svelte/action';

/**
 * Grows a textarea with its content, up to its CSS max-height, then lets it
 * scroll. Replaces the resize handle, which looked out of place.
 *
 * Pass the bound value (`use:autogrow={value}`) so text set from code, like a
 * preset filling the prompt, resizes the box too.
 */
export const autogrow: Action<HTMLTextAreaElement, unknown> = (node) => {
	let frame = 0;
	let lastWidth = 0;

	function resize() {
		// A hidden pane (the phone layout's other tab) measures zero; wait until shown.
		if (node.offsetParent === null) return;
		const style = getComputedStyle(node);
		const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
		const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
		const max = parseFloat(style.maxHeight) || Infinity;
		node.style.height = 'auto';
		// scrollHeight counts padding but not border; `height` means different things
		// depending on the box model, and max-height follows the same one.
		const wanted =
			style.boxSizing === 'border-box' ? node.scrollHeight + border : node.scrollHeight - padding;
		node.style.height = `${Math.min(wanted, max)}px`;
		node.style.overflowY = wanted > max ? 'auto' : 'hidden';
	}

	// Re-measure when the width changes (wrapping) or the pane first appears. Deferred
	// a frame so resizing inside the observer callback cannot loop.
	const observer = new ResizeObserver((entries) => {
		const width = entries[0]?.contentRect.width ?? 0;
		if (width === lastWidth) return;
		lastWidth = width;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(resize);
	});

	node.addEventListener('input', resize);
	observer.observe(node);
	resize();

	return {
		update() {
			resize();
		},
		destroy() {
			node.removeEventListener('input', resize);
			observer.disconnect();
			cancelAnimationFrame(frame);
		}
	};
};
