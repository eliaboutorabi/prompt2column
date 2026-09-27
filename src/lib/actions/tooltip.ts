import type { Action } from 'svelte/action';

export type TooltipParam =
	| string
	| { text: string; /** A shortcut shown as a key cap, like ⌘F. */ kbd?: string }
	| null
	| undefined;

/** Wait this long on first hover; once one tooltip has shown, neighbours show at once. */
const DELAY = 450;
const WARM_FOR = 500;
const GAP = 8;
const EDGE = 8;

let tip: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let hiddenAt = 0;
let listening = false;

/** One listener for the whole page: any scroll hides whatever tooltip is up. */
function listen() {
	if (listening) return;
	listening = true;
	window.addEventListener('scroll', () => hide(), true);
}

function element(): HTMLDivElement {
	if (tip?.isConnected) return tip;
	tip = document.createElement('div');
	tip.id = 'app-tooltip';
	tip.className = 'tooltip';
	tip.setAttribute('role', 'tooltip');
	tip.popover = 'manual';
	document.body.append(tip);
	return tip;
}

function normalise(param: TooltipParam): { text: string; kbd?: string } | null {
	if (!param) return null;
	return typeof param === 'string' ? { text: param } : param.text ? param : null;
}

function place(target: HTMLElement, node: HTMLDivElement) {
	const box = target.getBoundingClientRect();
	const { width, height } = node.getBoundingClientRect();
	// Above by default; below when the target sits too close to the top, as the header does.
	const above = box.top - GAP - height;
	const top = above < EDGE ? box.bottom + GAP : above;
	const left = Math.min(
		Math.max(EDGE, box.left + box.width / 2 - width / 2),
		window.innerWidth - width - EDGE
	);
	node.style.top = `${Math.round(top)}px`;
	node.style.left = `${Math.round(left)}px`;
	node.dataset.side = above < EDGE ? 'below' : 'above';
}

function show(target: HTMLElement, content: { text: string; kbd?: string }) {
	const node = element();
	node.replaceChildren(document.createTextNode(content.text));
	if (content.kbd) {
		const kbd = document.createElement('kbd');
		kbd.textContent = content.kbd;
		node.append(kbd);
	}
	if (!node.matches(':popover-open')) node.showPopover();
	place(target, node);
	owner = target;
	// Only describe the target when the tooltip says more than its name already does.
	const name = target.getAttribute('aria-label') ?? target.textContent?.trim();
	if (content.text !== name) target.setAttribute('aria-describedby', node.id);
}

function hide(target?: HTMLElement) {
	clearTimeout(timer);
	if (target && owner !== target) return;
	if (owner) {
		if (owner.getAttribute('aria-describedby') === 'app-tooltip') {
			owner.removeAttribute('aria-describedby');
		}
		hiddenAt = performance.now();
	}
	owner = null;
	if (tip?.matches(':popover-open')) tip.hidePopover();
}

/**
 * A small label for icon buttons and terse controls, drawn in the app's own
 * style instead of the browser's `title` bubble. Shows on hover and keyboard
 * focus, never on touch.
 */
export const tooltip: Action<HTMLElement, TooltipParam> = (node, param) => {
	let content = normalise(param);

	function schedule() {
		if (!content) return;
		clearTimeout(timer);
		const warm = performance.now() - hiddenAt < WARM_FOR || owner !== null;
		const current = content;
		timer = setTimeout(() => show(node, current), warm ? 0 : DELAY);
	}

	const onPointerEnter = (event: PointerEvent) => {
		if (event.pointerType !== 'touch') schedule();
	};
	const onLeave = () => hide(node);
	const onFocus = () => {
		if (node.matches(':focus-visible')) schedule();
	};
	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && owner === node) hide(node);
	};
	node.addEventListener('pointerenter', onPointerEnter);
	node.addEventListener('pointerleave', onLeave);
	node.addEventListener('pointerdown', onLeave);
	node.addEventListener('focus', onFocus);
	node.addEventListener('blur', onLeave);
	node.addEventListener('keydown', onKeydown);
	listen();

	return {
		update(next) {
			content = normalise(next);
			if (owner === node) {
				if (content) show(node, content);
				else hide(node);
			}
		},
		destroy() {
			hide(node);
			node.removeEventListener('pointerenter', onPointerEnter);
			node.removeEventListener('pointerleave', onLeave);
			node.removeEventListener('pointerdown', onLeave);
			node.removeEventListener('focus', onFocus);
			node.removeEventListener('blur', onLeave);
			node.removeEventListener('keydown', onKeydown);
		}
	};
};
