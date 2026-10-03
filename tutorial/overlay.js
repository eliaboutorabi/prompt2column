// Injected into every page of the recording. It draws what a screen recording
// would show that a headless browser doesn't (the pointer, its clicks, a name
// card) and steps the page's animations by video time, so each frame is exact
// no matter how long it took to capture.
(() => {
	if (window.__tut) return;

	const tracked = new Map(); // animation -> video time it was first seen
	let root = null;
	let cursor = null;
	let ripples = null;
	let lower = null;
	let topCount = -1;
	let mutated = true;

	const css = `
		#__tut { position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0; padding: 0;
			border: 0; background: transparent; overflow: visible; pointer-events: none; color: inherit; }
		#__tut * { pointer-events: none; }
		#__tut .cursor { position: absolute; left: 0; top: 0; width: 22px; height: 33px;
			transform-origin: 1.5px 1.5px; filter: drop-shadow(0 1.5px 2px rgb(0 0 0 / 0.38)); }
		#__tut .ring { position: absolute; left: 0; top: 0; border-radius: 999px;
			border: 2px solid oklch(0.86 0.17 118); background: oklch(0.86 0.17 118 / 0.16); }
		#__tut .lower { position: absolute; bottom: 52px; display: flex; gap: 14px;
			align-items: stretch; padding: 14px 24px 15px 16px; border-radius: 14px;
			background: oklch(0.19 0.008 110 / 0.86); border: 1px solid oklch(1 0 0 / 0.08);
			box-shadow: 0 18px 50px oklch(0.05 0 0 / 0.45); -webkit-backdrop-filter: blur(14px);
			backdrop-filter: blur(14px); font-family: 'Geist Variable', ui-sans-serif, system-ui; }
		#__tut .lower .bar { width: 4px; border-radius: 4px; background: oklch(0.83 0.175 118); }
		#__tut .lower .name { font-size: 23px; font-weight: 600; letter-spacing: -0.015em;
			color: oklch(0.97 0.004 110); line-height: 1.2; }
		#__tut .lower .role { margin-top: 3px; font-size: 15px; color: oklch(0.78 0.01 110); }
		* { caret-color: transparent !important; }
	`;

	const arrow = `<svg class="cursor" viewBox="0 0 22 33" xmlns="http://www.w3.org/2000/svg">
		<path d="M1.5 1.5 L1.5 24.6 L7.1 19.4 L11.2 28.9 L14.9 27.3 L10.8 18 L18.6 18 Z"
			fill="#121212" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

	function ensure() {
		if (root?.isConnected) return true;
		if (!document.body) return false;
		root = document.createElement('div');
		root.id = '__tut';
		root.setAttribute('popover', 'manual');
		root.innerHTML = `<style>${css}</style><div class="lower" style="opacity:0">
			<div class="bar"></div><div><div class="name"></div><div class="role"></div></div></div>
			<div class="ripples"></div>${arrow}`;
		document.body.append(root);
		cursor = root.querySelector('.cursor');
		ripples = root.querySelector('.ripples');
		lower = root.querySelector('.lower');
		root.showPopover();
		new MutationObserver((records) => {
			if (records.some((record) => !root.contains(record.target))) mutated = true;
		}).observe(document.documentElement, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true
		});
		topCount = -1;
		return true;
	}

	/** Keeps the overlay above anything that opens in the top layer after it. */
	function restack() {
		const count =
			document.querySelectorAll(':popover-open').length +
			document.querySelectorAll('dialog:modal').length;
		if (count === topCount) return;
		root.hidePopover();
		root.showPopover();
		topCount = count;
	}

	const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

	/**
	 * One video frame. Seeks every animation on the page to video time, then
	 * draws the overlay. Returns whether anything on screen may have changed.
	 */
	function frame(t, view) {
		if (!ensure()) return { dirty: true };
		let animating = false;
		const live = new Set(document.getAnimations());
		for (const animation of live) {
			if (!tracked.has(animation)) {
				tracked.set(animation, t);
				animation.pause();
			}
			const local = (t - tracked.get(animation)) * 1000;
			animation.currentTime = local;
			const end = animation.effect?.getComputedTiming().endTime ?? 0;
			if (end === Infinity || local < end) animating = true;
		}
		for (const animation of tracked.keys()) if (!live.has(animation)) tracked.delete(animation);

		restack();

		// The pointer: tip at (x, y), squeezed a little while the button is down.
		const scale = view.pressed ? 0.86 : 1;
		cursor.style.transform = `translate(${view.x - 1.5}px, ${view.y - 1.5}px) scale(${scale})`;
		cursor.style.opacity = view.hidden ? '0' : '1';

		// Click rings: grow and fade over half a second.
		let ringsHtml = '';
		for (const ring of view.rings) {
			const p = (t - ring.t) / 0.55;
			if (p < 0 || p > 1) continue;
			const r = 5 + 21 * ease(p);
			const alpha = 0.9 * (1 - p);
			ringsHtml += `<div class="ring" style="width:${2 * r}px;height:${2 * r}px;transform:translate(${ring.x - r}px,${ring.y - r}px);opacity:${alpha}"></div>`;
		}
		if (ripples.innerHTML !== ringsHtml) ripples.innerHTML = ringsHtml;

		// The name card: slides up and fades in, then fades out.
		const card = view.card;
		if (card) {
			root.querySelector('.name').textContent = card.name;
			root.querySelector('.role').textContent = card.role;
			const inP = ease((t - card.in) / 0.6);
			const outP = ease((t - card.out) / 0.5);
			const shown = Math.max(0, inP - outP);
			lower.style.opacity = String(shown);
			lower.style.left = card.side === 'right' ? 'auto' : '44px';
			lower.style.right = card.side === 'right' ? '44px' : 'auto';
			lower.style.transform = `translateY(${(1 - inP) * 14}px)`;
		}

		const dirty = mutated || animating;
		mutated = false;
		return { dirty };
	}

	window.__tut = { frame };
})();
